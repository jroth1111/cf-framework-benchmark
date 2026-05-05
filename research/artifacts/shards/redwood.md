### redwood

#### Findings
- **[redwood-F01]** RedwoodSDK's default model is already the right baseline for page-speed work on Workers: components are server components by default, HTML is streamed to the client, and only `"use client"` modules hydrate in the browser. React's RSC docs still make the core cost model explicit: a `"use client"` file pulls its transitive dependency subtree into the client bundle. For this repo, that means the current `apps/redwood/src/client.tsx` entry should stay tiny, and any future interactive chart/media UI should be isolated behind the smallest possible client boundary. Confidence: HIGH. Sources: https://docs.rwsdk.com/core/react-server-components/ and https://react.dev/reference/rsc/use-client
- **[redwood-F02]** RedwoodSDK's `serverQuery` is a real RSC-specific optimization, not just an API style preference: current docs say it returns data only and skips page re-render/rehydration by using an `x-rsc-data-only` path. For benchmark routes with client-side filters, sorters, or incremental fetches, `serverQuery` is the supported way to avoid shipping a full updated UI tree back to the browser. Confidence: HIGH. Source: https://docs.rwsdk.com/core/react-server-components/
- **[redwood-F03]** RedwoodSDK client navigation has a built-in memory/perf tradeoff. Prefetch works by fetching `?__rsc` payloads into the browser Cache API, and RedwoodSDK recommends wiring `onHydrated` because it performs cache eviction and helps prevent memory bloat. This repo already does that in `apps/redwood/src/client.tsx`, so the current setup matches the documented low-risk path; adding broad prefetch hints across heavy routes would improve nav latency but can raise client memory residency. Confidence: HIGH. Sources: https://docs.rwsdk.com/guides/frontend/client-side-nav/ and https://docs.rwsdk.com/reference/sdk-client/
- **[redwood-F04]** RedwoodSDK explicitly warns that manual `renderToStream()` is for HTML streaming only and does not handle the protocol negotiation needed for Server Actions and client-side transitions. For interactive benchmark pages, the supported performance path is to keep using `render()` in `defineApp`, not to "optimize" by replacing it with manual stream rendering. Confidence: HIGH. Source: https://docs.rwsdk.com/core/react-server-components/
- **[redwood-F05]** Cloudflare's current Workers docs still emphasize streaming over buffering as the primary memory-control lever: responses can be streamed by default, and avoiding buffering is specifically recommended under the 128 MB isolate limit. That aligns with RedwoodSDK's RSC/streaming architecture and argues against introducing large serialized JSON blobs, HTML concatenation, or response buffering in benchmark routes. Confidence: HIGH. Sources: https://developers.cloudflare.com/workers/runtime-apis/streams/ and https://developers.cloudflare.com/workers/platform/limits/
- **[redwood-F06]** React Compiler is now documented by both React and RedwoodSDK as a supported optimization path for React 19 + Vite. RedwoodSDK's guide is specific: add `@vitejs/plugin-react` with `babel-plugin-react-compiler` before the Cloudflare and Redwood plugins. For RSC-oriented apps this is one of the few current, supported ways to reduce client CPU without adding memoization boilerplate. Confidence: HIGH. Sources: https://docs.rwsdk.com/guides/optimize/react-compiler/ and https://react.dev/learn/react-compiler/installation
- **[redwood-F07]** Cloudflare's current compatibility-flag docs say `nodejs_compat_v2` increases bundle size. In this repo, `apps/redwood/wrangler.jsonc` enables `nodejs_compat`, but the app code shown is using standard web APIs plus RedwoodSDK. For a benchmark where startup time and Worker load cost matter, `nodejs_compat` should be treated as opt-in overhead and re-validated rather than left on by default. Confidence: MEDIUM. Sources: https://developers.cloudflare.com/workers/configuration/compatibility-flags/ and local `apps/redwood/wrangler.jsonc`
- **[redwood-F08]** Cloudflare Static Assets are now tightly integrated with Workers and automatically edge-cached; the current app already binds `dist/client` as static assets. That means the right optimization pattern is to keep long-lived assets in the asset pipeline and avoid pushing avoidable bytes into per-request HTML. In this repo, the large inline stylesheet in `apps/redwood/src/app/document.tsx` is a candidate tradeoff: inline CSS removes one request, but it also prevents shared edge/browser caching across navigations and repeats bytes on every HTML response. Confidence: HIGH. Sources: https://developers.cloudflare.com/workers/static-assets/ and https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/
- **[redwood-F09]** React 19's resource-loading APIs (`preload`, `preloadModule`, `preinitModule`) are current, supported levers for making route-specific assets available earlier, but React explicitly notes frameworks may already manage this. In RedwoodSDK, these are most defensible for narrowly targeted cases like preloading a lazily split chart/media module after user intent, not as blanket hints on the whole app. Confidence: MEDIUM. Sources: https://react.dev/reference/react-dom/preloadModule and https://react.dev/reference/react-dom/preinitModule

#### Recommendations
- Keep the Redwood entry/client boundary minimal. Do not move route UI into `"use client"` unless interactivity requires it; if chart/media evolve into React components, isolate only the control surface.
- Prefer `serverQuery` for any benchmark interaction that only needs data back. It is the clearest RedwoodSDK-specific lever to reduce client CPU, network bytes, and rehydration work.
- Keep using `render(Document, routes)` in `defineApp` for interactive routes. Do not swap to manual `renderToStream()` for page routes.
- Add React Compiler in `apps/redwood/vite.config.mts` on an experiment branch. It is currently the highest-confidence supported optimization for reducing client-side React work.
- Treat Redwood prefetch as selective, not global. Use it only on routes where navigation latency matters more than first-load memory, and keep `onHydrated` wired exactly as it is now.
- Re-test `nodejs_compat` necessity. If the emitted Worker and dependencies do not require Node APIs, removing it is a plausible startup-size win.
- Consider moving the large inline stylesheet in `Document` into a static CSS asset if benchmark scoring favors repeated navigations, transferred bytes, or cache reuse more than single-request render completeness.
- If chart/media code becomes module-split, use React 19 resource hints only for specific high-probability transitions rather than broad eager loading.

#### Risks
- Overusing prefetch can improve navigation metrics while worsening first-load memory and unused RSC payload residency.
- React Compiler is supported, but some components may be skipped or require opt-out; verify with DevTools/build output before treating results as benchmark-stable.
- Removing `nodejs_compat` can break dependencies indirectly pulled in by RedwoodSDK or future packages even if current app code looks web-standard.
- Moving inline CSS to static assets can worsen cold first paint on single-page tests even if it helps repeat navigations and cache efficiency.
- `serverQuery` only helps where the UI does not need a fresh server-rendered tree; using it for state-changing flows would be the wrong semantic tool.

#### Gaps
- I did not find recent primary-source benchmark numbers quantifying RedwoodSDK `serverQuery` vs full server-action re-render cost on real routes.
- RedwoodSDK docs describe prefetch/cache eviction behavior, but do not publish measured browser memory impact for heavy prefetch patterns.
- I did not verify the built Worker artifact to confirm whether `nodejs_compat` is materially increasing startup size in this repo.
- No primary RedwoodSDK source quantified the inline-CSS vs static-asset tradeoff for Workers-hosted RSC apps; that remains benchmark-specific.

#### Queries Used
- `RedwoodSDK performance optimization latest Cloudflare Workers`
- `RedwoodSDK React Server Components performance latest`
- `RedwoodSDK workers streaming performance latest`
- `site:redwoodjs.com RedwoodSDK performance Cloudflare`
- `RedwoodSDK pitfalls performance memory latest`
- `React Server Components Cloudflare Workers performance best practices`
- `site:docs.rwsdk.com RedwoodSDK React Compiler`
- `site:docs.rwsdk.com RedwoodSDK server functions react server components`
- `site:docs.rwsdk.com prefetch RedwoodSDK`
- `site:developers.cloudflare.com workers streams readableStream response latest`
- `site:developers.cloudflare.com workers static assets cache-control latest`
- `site:developers.cloudflare.com workers compatibility flags nodejs_compat latest`
- `site:react.dev "use client" server components latest`
- `site:react.dev react compiler installation`
- `site:react.dev preloadModule preinitModule react 19`

#### Sources
- [React Server Components | RedwoodSDK](https://docs.rwsdk.com/core/react-server-components/) - RedwoodSDK RSC defaults, `serverQuery`, `serverAction`, `renderToStream` caveat - Primary
- [Client Side Navigation (Single Page Apps) | RedwoodSDK](https://docs.rwsdk.com/guides/frontend/client-side-nav/) - `?__rsc` navigation, prefetch, Cache API, cache eviction, memory-bloat note - Primary
- [sdk/client | RedwoodSDK](https://docs.rwsdk.com/reference/sdk-client/) - `initClient` and `onHydrated` behavior surface - Primary
- [React Compiler | RedwoodSDK](https://docs.rwsdk.com/guides/optimize/react-compiler/) - RedwoodSDK-supported compiler setup and plugin ordering - Primary
- [`'use client'` directive - React](https://react.dev/reference/rsc/use-client) - client-boundary and transitive dependency cost model - Primary
- [React Compiler Installation](https://react.dev/learn/react-compiler/installation) - compiler support, plugin ordering, verification - Primary
- [Workers Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/) - stream instead of buffer guidance, response streaming behavior - Primary
- [Limits · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/limits/) - 128 MB isolate memory limit, larger bundles affecting startup, streaming recommendation - Primary
- [Compatibility flags · Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) - `nodejs_compat_v2` increases bundle size - Primary
- [Static Assets · Cloudflare Workers docs](https://developers.cloudflare.com/workers/static-assets/) - integrated static-asset serving and caching on Workers - Primary
- [Static Assets · Cloudflare Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/) - Vite-plugin asset handling on Workers - Primary
- [preloadModule - React](https://react.dev/reference/react-dom/preloadModule) - module preload semantics and caveat that frameworks may handle resource loading - Primary
- [preinitModule - React](https://react.dev/reference/react-dom/preinitModule) - eager module fetch/evaluation semantics - Primary
