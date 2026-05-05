### waku

#### Findings
- The local app already follows Waku's core performance model reasonably well: pages are server components by default, and only explicitly marked client components hydrate. Waku's current docs make the cost model explicit: a `'use client'` boundary creates the server-client split, and everything imported below that boundary hydrates in the browser. In this repo, that means the main optimization lever is keeping the client islands as small as possible. Sources: https://waku.gg/ (client components section)
- The chart route is currently the most expensive client island. [`apps/waku/src/pages/chart.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/waku/src/pages/chart.tsx) is static server output that imports [`apps/waku/src/components/ChartClient.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/waku/src/components/ChartClient.tsx), and that client component eagerly imports `@cf-bench/chart-core`, fetches price data, and hydrates all chart controls. This is the strongest candidate for reducing client work.
- `ChartClient` currently refetches and reapplies indicators whenever `symbol`, `timeframe`, or `indicators` change, with `indicators` included in the fetch effect dependency list. That means toggling an indicator triggers a full data-loading effect even though the candle data itself does not depend on indicators. This is a repo-specific client CPU/network inefficiency in [`apps/waku/src/components/ChartClient.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/waku/src/components/ChartClient.tsx).
- The media route is already close to Waku's intended shape. [`apps/waku/src/pages/media.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/waku/src/pages/media.tsx) queries data in a server component and passes it into a smaller interactive client component. That is the kind of boundary Waku's docs encourage.
- Waku's current docs highlight lazy slices as the mechanism for independently requested dynamic components on otherwise static pages, similar to server islands. This is potentially useful if parts of the chart or media experience can be split out from the rest of the page shell. Source: https://waku.gg/ (lazy slices section)
- Waku provides both static prerendering and SSR, and this repo is already opting routes like chart/media into `render: 'static'`. That is a strong first-load baseline; the remaining performance work is primarily about island size and unnecessary client effects rather than changing render mode. Source: https://waku.gg/ (server-side rendering / tl;dr sections)

#### Recommendations
- Highest-confidence change: fix the chart island's effect graph in [`apps/waku/src/components/ChartClient.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/waku/src/components/ChartClient.tsx).
  - Separate candle fetching from indicator toggling.
  - Re-fetch only on `symbol` / `timeframe` changes.
  - Apply `setIndicators()` in a separate cheap effect so indicator toggles do not trigger extra network and chart reset work.
- Keep the `'use client'` boundary as low as possible.
  - Do not move route/page shells or static copy into client components.
  - If chart controls can be split from the canvas widget, consider smaller client islands instead of one large hydrated subtree.
- Explore Waku lazy slices for non-critical dynamic sections if the benchmark allows progressive enhancement on those subtrees.
- Keep the media route architecture largely as-is; it already follows the better server-data/client-interaction split.
- If bundle analysis shows chart-core leaking into unrelated chunks, isolate the chart client code more aggressively or dynamically import the heavy chart implementation inside the client island.

#### Risks
- Splitting the chart into smaller islands or lazy slices can improve initial page metrics while slightly worsening first interaction if the benchmark enters the route and immediately manipulates controls.
- Over-fragmenting client islands can add complexity and make data/control boundaries harder to reason about.
- Waku is still early-stage (`1.0.0-alpha.5` locally), so some advanced boundary/lazy-slice patterns may be less stable than in mature frameworks.

#### Gaps
- I did not find a more formal Waku optimization guide beyond the current product docs; most evidence is architectural rather than benchmark-measured.
- I did not run a bundle breakdown for `apps/waku`, so I have not confirmed current chunk boundaries around `ChartClient`.
- I did not inspect whether Waku exposes additional route-level prefetch controls beyond the router APIs documented on the main site.

#### Queries Used
- site:waku.gg client components use client Waku
- site:waku.gg lazy slices Waku
- Waku server components performance official
- Waku static render client components official

#### Sources
- https://waku.gg/
