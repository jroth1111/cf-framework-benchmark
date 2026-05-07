# Exhaustive Logic Audit - 2026-05-07

Tracking bead: `cf-framework-benchmark-d8l`

## Task Class

`planned-multi-item`, with `contract-surface-change` handling for any public API,
CLI, config, matrix, result, or persistence behavior changed during the audit.

## Source Requirement

Audit this repository as a reusable, whole-codebase bug hunt:

- inventory first-party runtime, config, script, contract, and test surfaces
- inspect meaningful behavior surfaces, not only failing gates
- track confirmed findings in beads
- fix confirmed source bugs and add targeted regressions where practical
- verify each fix with positive and negative evidence
- finish with a coverage matrix that names inspected, fixed, blocked/descoped,
  passed probes, and residual risk

## Project-Rule Preflight

Scanned `AGENTS.md`, `CLAUDE.md`, `README.md`, `.claude/settings.json`,
`.beads/README.md`, root scripts, contract docs, and package scripts.

Rules affecting this audit:

- use `bd` for task tracking
- run `bd prime` after compaction/session recovery
- use non-interactive file-operation flags
- before session close, close completed beads, run quality gates, push beads and git
- `docs/contracts-v5.md` is the authority for canonical v5 benchmark behavior
- `docs/contracts-v6-addendum.md` is additive for hifi behavior
- `pnpm verify:static`, `pnpm test:contracts`, `pnpm check:targets`,
  `pnpm check:startup`, and live gates define major verification surfaces

## Inventory

Current first-party tracked inventory is based on `git ls-files`, excluding
dependency/build/cache directories. Generated or vendored framework artifacts are
classified separately when they are tracked but not authored as logic.

| Surface | Initial Coverage | Notes |
| --- | --- | --- |
| root/package scripts | inspected | Script graph inventoried from root `package.json` and package manifests. |
| contract docs | inspected | `contracts-v3`, `contracts-v5`, and `contracts-v6-addendum` checked for API and route authority. |
| shared packages | in progress | `bench-utils`, `dataset`, `bench-contract`, `bench-control` under active audit. |
| benchmark runner/config | in progress | `run-v4` flag forwarding, provenance contract hashing, and Astro hifi matrix eligibility audited/fixed; targets, result verification, and deeper runner paths still open. |
| repo scripts | in progress | Contract report/test path audited; startup, static, deploy, verify, and live scripts still open. |
| app routes/API integrations | not_started | Enabled app entrypoints and shared contract integration still open. |
| disabled/experimental apps | not_started | Must classify as intentionally excluded or bug-bearing if referenced by active gates. |
| CI/workflows | in progress | Scheduled benchmark workflow hifi omission audited/fixed; broader CI workflow review still open. |
| tracked generated artifacts | not_started | Must classify as generated authority, stale output, or ignorable build residue. |

## Findings

### F-001: Public API numeric params accepted fractional and unbounded values

Bead: `cf-framework-benchmark-e5m`

Status: `verified`

Evidence:

- Source requirement: public benchmark APIs must return successful JSON with
  expected shapes for `/api/listings?pageSize=1`,
  `/api/prices?symbol=BTC&timeframe=1h&points=120`, and
  `/api/media?pageSize=3`; helper name `parseIntParam` and dataset pagination
  fields imply integer page, pageSize, and point counts.
- Root cause: `packages/bench-utils/src/index.js` parsed query params with
  `Number(value)` and returned arbitrary finite numbers; `packages/dataset`
  clamped ranges without integer normalization; `generateCandles` did not cap
  `points`.
- Fix evidence: `parseIntParam` now truncates finite values; `queryListings`,
  `queryMedia`, and `generateCandles` normalize integers at the dataset authority;
  `generateCandles` caps requested points at `MAX_CANDLE_POINTS`.
- Positive probes:
  - `pnpm test:dataset` passed with fractional, negative, and oversized dataset cases.
  - `pnpm test:control-package` passed with parser regression cases.
  - `pnpm test:contracts` passed across enabled contract targets.
  - `pnpm test`, `pnpm check:targets`, and `pnpm verify:static` passed at the
    shared API boundary checkpoint.
- Negative probe:
  - regressions assert fractional page/pageSize and point counts no longer leak
    fractional metadata or fractional/unbounded result sizes.
- Residual gap: command evidence will be re-run with timestamp/cwd/exit-code
  capture before final completion.

## Acceptance Holes

For F-001:

- Negative-probe hole: a framework could bypass shared `bench-contract` and parse
  its own API params incorrectly. Open until app/API integration audit confirms
  enabled targets route through the shared handler or have equivalent checks.
- Positive-probe hole: live deployed targets are not yet re-probed for the new
  boundary. Static/local contract probes passed; live verification remains a
  final or environment-gated audit step.

### F-002: Enabled apps carried bespoke API handlers that drifted from shared contract authority

Bead: `cf-framework-benchmark-gmd`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v5.md` says required APIs, routes,
  selectors, and cache behavior are benchmark contract details; `docs/contracts-v6-addendum.md`
  adds `mpa_airbnb_hifi`; matrix rows for Next, Astro, and Svelte have
  `hifi.enabled: true`.
- Root cause: Next, Astro, and Svelte carried route-local copies of `/api/bench`,
  `/api/health`, `/api/listings`, `/api/listings/:id`, `/api/prices`, or
  `/api/media` logic instead of delegating to `packages/bench-contract`. Their
  `/api/bench` copies reported only `mpa_airbnb` and `spa_trading_media`.
- Fix evidence: the duplicate route files now call `handleContractApi` from
  `@cf-bench/bench-contract`; Next and Astro declare the workspace dependency.
- Positive probes:
  - `pnpm test:contracts` passed after the replacement.
  - `pnpm --filter cf-bench-next build` passed.
  - `pnpm --filter cf-bench-astro build` passed after refreshing workspace links.
  - `pnpm --filter cf-bench-svelte build` passed.
  - `pnpm test`, `pnpm check:targets`, and `pnpm verify:static` passed at the
    shared API boundary checkpoint.
- Negative probe:
  - `rg` over Next/Astro/Svelte app API sources found no remaining route-local
    `parseIntParam`, direct `Number(url.searchParams...)`, or stale two-suite
    `suiteSupport` literals.
- Verification-failure classification:
  - First Next/Astro build failures were `environment` / dependency-link state:
    package manifests and lockfile were updated but `--lockfile-only` had not
    linked the new workspace dependency into app `node_modules`. `pnpm install`
    refreshed links; both builds then passed.
- Residual gap: broader app audit still needs to cover route/cache/hifi selector
  parity beyond these API files.

### F-003: Contract report under-checked hifi routes

Bead: `cf-framework-benchmark-4xo`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` requires `/hifi/stays` and
  `/hifi/stays/:id` selectors, cache policies, and dataset content checks for
  hifi-enabled frameworks. `contract-report` is part of `verify:live` and is the
  persisted contract evidence artifact.
- Root cause: `scripts/contract-tests.mjs` had hifi route sample, selector,
  cache, dataset-content, and hifi-enabled filtering logic, but
  `scripts/contract-report.mjs` only knew v5 route semantics. It would sample
  `/hifi/stays/:id` literally, omit hifi selectors/cache/content, and probe hifi
  routes for frameworks whose matrix did not enable hifi.
- Fix evidence: `contract-report` now exports and uses hifi-aware route helpers,
  filters hifi routes by `framework.matrix.hifi.enabled`, and has a dedicated
  regression test in `scripts/test-contract-report.mjs`.
- Positive probes:
  - `pnpm test:contract-report` passed.
  - `node --check scripts/contract-report.mjs && node --check scripts/verify-static.mjs` passed.
  - `pnpm test:contracts` passed after the report changes.
  - `pnpm verify:static` passed after wiring `test:contract-report` into the
    static gate.
- Negative probe:
  - the new regression asserts non-hifi frameworks drop `/hifi/*` routes, while
    hifi-enabled frameworks retain them; it also asserts `/hifi/stays/:id`
    samples `/hifi/stays/001` and requires all v6 detail selectors.
- Residual gap: live `pnpm verify:live -- --suites mpa_airbnb_hifi` was not run
  in this checkpoint because it hits deployed targets; static and local contract
  evidence passed.

## Checkpoint Evidence

Shared API boundary checkpoint:

- `pnpm test`: passed
- `pnpm check:targets`: passed, 19 targets
- `pnpm test:contracts`: passed
- `pnpm --filter cf-bench-next build`: passed
- `pnpm --filter cf-bench-astro build`: passed after `pnpm install` refreshed
  workspace links
- `pnpm --filter cf-bench-svelte build`: passed
- `pnpm verify:static`: passed, including matrix, targets, dataset, deploy,
  runner, control, result verification, Cloudflare config/optimization audits,
  all benchmark-enabled builds, and Worker startup checks

Contract report hifi checkpoint:

- `pnpm test:contract-report`: passed
- `node --check scripts/contract-report.mjs && node --check scripts/verify-static.mjs`: passed
- `pnpm test:contracts`: passed
- `pnpm verify:static`: passed

### F-004: v4 runner silently dropped documented real-device flag

Bead: `cf-framework-benchmark-6rq`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` documents
  `--realdevice browserstack:iphone-13` as a runner flag implemented by
  `bench/src/run.mjs`; the normal suite entrypoint is `bench/src/run-v4.mjs`.
- Root cause: `run-v4` forwarded profile, seed, throttle, CPU/network, and
  flamegraph options to `run.mjs`, but omitted `--realdevice`, so documented
  real-device runs through the v4 entrypoint were silently executed in local
  Playwright mode.
- Fix evidence: `runnerPassthroughArgs` is now exported and includes
  `--realdevice` in the pair allowlist; `main()` uses the shared helper.
- Positive probe:
  - `pnpm test:bench-runner` passed with a regression asserting
    `--realdevice browserstack:iphone-13` is forwarded to `run.mjs`.
  - `pnpm verify:static` passed after the runner change, including
    `test:bench-runner`, result-artifact verification, all enabled builds, and
    Worker startup checks.
- Negative probe:
  - the same regression asserts `run-v4` does not synthesize `--realdevice`
    when it is absent from argv.
- Residual gap: no BrowserStack live run was performed; this fix proves CLI
  routing to the existing real-device implementation, not provider availability.

### F-005: Hifi provenance contract hash omitted v6 addendum

Bead: `cf-framework-benchmark-7yt`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` is additive to v5 and says
  all v5 anti-gaming requirements, including recorded contract hashes, apply to
  v6 runs.
- Root cause: `bench/src/run.mjs` populated `provenance.hashes.contract` with
  only `docs/contracts-v5.md` (or legacy v3 fallback). Changes to hifi contract
  requirements could therefore leave benchmark provenance unchanged.
- Fix evidence: `benchmarkContractHashInput()` now includes both the v5 contract
  hash and the v6 addendum hash; `provenance.hashes.contract` hashes that
  combined input.
- Positive probe:
  - `pnpm test:bench-runner` passed with a regression asserting the contract
    hash input includes both `v5` and `v6Addendum`.
  - `pnpm verify:static` passed after the provenance change, including
    `test:bench-runner`, `test:verify-results`, result-artifact verification,
    all enabled builds, and Worker startup checks.
- Negative probe:
  - the regression would fail if `v6Addendum` were removed from the provenance
    contract hash input.
- Residual gap: existing historical result files are not regenerated by this
  source fix; future runs will carry the combined contract hash.

Runner/provenance checkpoint:

- `pnpm test:bench-runner`: passed
- `pnpm verify:static`: passed, including matrix, targets, dataset, deploy,
  runner, contract-report, control, result verification, result-artifact
  policy, Cloudflare config/optimization audits, all benchmark-enabled builds,
  and Worker startup checks

### F-006: Astro hifi routes were implemented but excluded by stale matrix metadata

Bead: `cf-framework-benchmark-1xl`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` says hifi-enabled
  frameworks are selected by matrix `hifi.enabled === true`, while hifi-pending
  frameworks are those lacking hifi deployment support such as
  `@cf-bench/bench-contract` integration.
- Root cause: `apps/astro` now declares both `@cf-bench/bench-contract` and
  `@cf-bench/hifi-shell` and contains `/hifi/stays` route files, but
  `bench/framework-matrix.json` still omitted Astro's `hifi` block. The stale
  regression still asserted Astro should remain hifi-pending because it lacked
  bench-contract integration.
- Fix evidence: the Astro matrix row now declares `hifi.enabled: true` and
  `imageTransforms: enabled`; the stale hifi-pending assertion was replaced by
  including Astro in the hifi-enabled framework list. The updated Astro Worker
  was deployed to make the live target match the source/matrix state.
- Positive probe:
  - `pnpm check:matrix` passed.
  - `pnpm test:cloudflare-config` passed with Astro in the hifi-enabled list.
  - `pnpm cloudflare:config-audit -- --hifi --fail-on-gaps` passed with
    20 hifi Workers targets and zero gaps.
  - `pnpm test:contracts -- --suites mpa_airbnb_hifi --only astro --timeout 20000`
    passed against the live Astro Worker after deploy.
- Negative probe:
  - before deploy, the same live hifi contract probe failed with 27 errors:
    missing `mpa_airbnb_hifi` suite support plus 404s and missing hifi selectors
    on `/hifi/stays` and `/hifi/stays/001`; after deploy the probe passed.
  - `test:cloudflare-config` would fail if Astro lacks the hifi block or
    required image transform metadata.
- External-control action:
  - deploy command: `pnpm -C apps/astro run deploy`.
  - new deployed version: `4b7dda21-bd7c-4754-b0f7-c1a4619ce2f4`.
  - rollback path recorded before deploy:
    `pnpm -C apps/astro exec wrangler rollback --name cf-bench-astro 17270828-fc8c-4ab2-b387-56b2b0db8a61`.
- Residual gap: broader all-framework hifi live verification remains outside
  this targeted Astro fix checkpoint.

### F-007: Scheduled benchmark workflow omitted canonical hifi results

Bead: `cf-framework-benchmark-4nf`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` defines
  `bench/results.v4.mpa_airbnb_hifi.{json,md}` as canonical hifi results and
  describes the `bench-remote` hifi mobile pathway for `mpa_airbnb_hifi`.
- Root cause: root/bench package scripts and `.github/workflows/benchmark.yml`
  only ran, verified, and uploaded `mpa_airbnb` and `spa_trading_media`; the
  live preflight and optional WebPageTest step also ran only the default v5
  suite set. Scheduled benchmark evidence could therefore never produce the v6
  hifi artifacts or preflight hifi routes.
- Fix evidence: added `bench:hifi` / `run:hifi`; `bench:all` and `run:all` now
  include hifi; the benchmark workflow now preflights/runs/verifies/uploads
  `mpa_airbnb_hifi` and has a separate optional hifi WebPageTest artifact.
  `scripts/test-ci-workflows.mjs` asserts the workflow and package scripts keep
  the hifi suite wired.
- Positive probe:
  - `pnpm test:ci-workflows` passed.
  - `node --check scripts/verify-static.mjs && node --check scripts/test-ci-workflows.mjs` passed.
  - `pnpm test:bench-runner` passed, preserving the hifi runner entrypoint
    behavior covered in F-004/F-005.
  - `pnpm verify:static` passed after wiring the workflow regression into the
    static gate.
- Negative probe:
  - `test:ci-workflows` would fail if the hifi suite,
    hifi live preflight, hifi result artifacts, hifi remote output,
    `mobile-hifi`, or `fast-4g` workflow wiring is removed.
- Residual gap: GitHub Actions itself is not run locally; verification is
  static workflow/script inspection plus repo static gate.

### F-008: Hifi live verification exposed stale Workers and header/filter gaps

Bead: `cf-framework-benchmark-hni`

Status: `verified`

Evidence:

- Source requirement: `docs/contracts-v6-addendum.md` makes
  `mpa_airbnb_hifi` the canonical hifi suite for hifi-enabled Workers; the live
  gates must prove hifi routes, hifi cache headers, `Server-Timing`, and hifi
  smoke paths at the deployed target URLs.
- Root causes:
  - Most live hifi-enabled Workers were stale and still returned 404 for
    `/hifi/stays` even though current source implemented the route.
  - Hono's direct `/hifi/stays` handlers bypassed the render helper that emits
    `Server-Timing`.
  - Svelte's response hook classified only v5 `/stays` and `/blog` pages as
    cacheable benchmark pages, so hifi pages were overwritten to `no-store`.
  - Vike and Waku declared hifi pages as hifi-enabled in source but omitted
    `/hifi/stays` and `/hifi/stays/*` from `assets.run_worker_first`, so
    prerendered hifi HTML was served asset-first without the Worker header
    wrapper.
  - The hifi live verifier filtered hifi document routes for non-hifi
    frameworks but still required non-hifi frameworks to advertise
    `mpa_airbnb_hifi` in `/api/bench`; smoke had the same missing hifi filter
    for scenario paths.
- Fix evidence:
  - Redeployed stale hifi-enabled Workers so live source and matrix state match.
  - Added direct `Server-Timing` emission to Hono hifi list/detail handlers.
  - Added hifi list/detail classification to the Svelte hook.
  - Added hifi page patterns to Vike and Waku `run_worker_first`.
  - Added `scripts/test-hifi-live-header-config.mjs` and wired it into
    `verify:static`.
  - Updated `scripts/contract-tests.mjs` and `scripts/smoke.mjs` to filter
    hifi suite support/scenarios by matrix `hifi.enabled`.
- Positive probes:
  - Before source/header fixes, `pnpm verify:live -- --suites mpa_airbnb_hifi --timeout 20000`
    reduced the stale-deploy failure from 17 targets to four header failures
    after redeploying stale Workers.
  - After source/header and verifier fixes, the same command passed:
    matrix check, target check, contract report, contract tests, and smoke.
  - `pnpm test:hifi-live-header-config` passed.
  - `node --check scripts/test-hifi-live-header-config.mjs`,
    `node --check scripts/contract-tests.mjs`, and
    `node --check scripts/smoke.mjs` passed.
- Negative probes:
  - The pre-fix live contract report failed with 574 checks while stale Workers
    returned 404 on hifi routes; after the stale redeploy, only Hono/Svelte/Vike/Waku
    header failures remained; after source/header redeploy, contract report was
    green for all 19 live targets.
  - `test-hifi-live-header-config` fails if Hono hifi handlers stop emitting
    `Server-Timing`, if Svelte stops classifying hifi pages as benchmark pages,
    or if Vike/Waku stop routing hifi pages through the Worker.
  - `contract-tests` now asserts non-hifi frameworks do not claim unsupported
    hifi suite support.
- External-control actions:
  - Rollback paths for the broad stale redeploy were recorded in bead
    `cf-framework-benchmark-hni` before mutation.
  - Rollback paths for the final Hono/Svelte/Vike/Waku source-header redeploy
    were recorded in the same bead before mutation.
- Residual gap: live verification is for the current Cloudflare account's
  Workers targets only; it does not prove GitHub Actions execution, but the
  workflow wiring is covered by F-007.
