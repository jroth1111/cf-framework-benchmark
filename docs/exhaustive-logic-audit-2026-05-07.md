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
| benchmark runner/config | not_started | `bench/src`, matrix, targets, result verification, and provenance still open. |
| repo scripts | in progress | Contract report/test path audited; startup, static, deploy, verify, and live scripts still open. |
| app routes/API integrations | not_started | Enabled app entrypoints and shared contract integration still open. |
| disabled/experimental apps | not_started | Must classify as intentionally excluded or bug-bearing if referenced by active gates. |
| CI/workflows | not_started | GitHub workflows and release/verification paths still open. |
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
