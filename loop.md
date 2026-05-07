# Goal Loop

Objective:
Eliminate the duplicated authority surfaces identified in the cf-framework-benchmark
architectural review by landing every one of the 10 ranked highest-leverage fixes,
completing the 4 follow-up audits that absorb the review's residual-risk list, and
finally running the full benchmark suite as a backgrounded task to prove the new
authority model end-to-end.

A **fix** is complete only when (a) its code change is committed to master, (b) the
proof test specified for that fix passes against current code (existing test reused or
new test added per the review), and (c) the existing repo gates still pass:
`pnpm test:contracts`, `pnpm cloudflare:config-audit`, `pnpm cloudflare:optimization-audit`,
`pnpm contract:report` (against live), `pnpm test:bench-runner`,
`pnpm test:bench-contract`, `pnpm test:cloudflare-config`, and `pnpm verify:results`
against the most recent canonical results file.

An **audit** is complete only when the file/area has been read in full, every
duplicated authority or contract bypass found is either folded into an existing fix
(1–10) with the relevant fix's proof test extended to cover it, or filed as a new beads
issue with the same proof-test discipline, and a brief evidence note is recorded
(commit message or bd issue body) naming what was inspected and what was found.

The **final benchmark run** is complete only when `pnpm bench:all` has finished with
exit code 0, every produced canonical result file contains
`provenance.hashes.scoring`, `provenance.hashes.suites`, and
`provenance.hashes.contract` (all non-null), no row carries `cf=unknown` in its
`bucketKeyScenario`, and no framework that the matrix marks `benchmarkEnabled=true`
(for the suite, including hifi gating) is missing from the result's `frameworks[]`.

## The 10 required fixes

1. **Single contract source `contracts/v5.json`.** New JSON listing every route with
   `sample`, `requiredTestIds`, `expectedHtmlCache`, `expectedDatasetContent`, and which
   suites it belongs to. Consumed by `scripts/contract-report.mjs` (replacing the switch
   statements at `:49-98`), by `scripts/cloudflare-config-audit.mjs` (replacing the
   `CONTRACT_ROUTES` literal at `:132`), and by suite JSONs (or kept in suite JSONs but
   cross-validated). Markdown contract docs regenerated from the JSON; `git diff
   --exit-code` after regen proves no drift. Provenance hashes the JSON.
2. **Delete `DEFAULT_SCENARIOS` (`bench/src/run.mjs:673-708`) and
   `fallbackScenarioContractForType` (`:719-724`).** `run.mjs` must throw if
   `config.scenarios` missing. Bucket-key output for every (framework × suite × scenario)
   triple unchanged before/after deletion; new unit test asserts this.
3. **Extract scoring rubric to `bench/scoring-rubric.json`.** Replace inline rubric at
   `bench/src/run.mjs:2135-2155`. Add `provenance.hashes.scoring = sha256(rubric)` to
   `:2463-2471`. New test: weights sum to 1.0; rubric hash present in every canonical
   result file; `run.mjs` contains no remaining `'real-world-choice-v1'` literal outside
   the loader.
4. **Hash `bench/suites/*.json` into provenance.** Add `provenance.hashes.suites` covering
   every file in `bench/suites/`. Test: changing a `waitFor` selector in a suite changes
   `provenance.hashes.suites`.
5. **Generate `HIFI_SUITE_FRAMEWORKS` from `bench/framework-matrix.json` at build time.**
   Replace the inline literal in `packages/bench-contract/src/index.js:22-44` with an
   import from a generated module produced by a build step (e.g., extension to
   `scripts/build-enabled.mjs`). Test: a script that fails CI if the generated set
   diverges from `frameworks.filter(f => f.hifi?.enabled).map(f => f.name)` in the
   matrix. Also: `handleBench` throws on empty/missing `framework`.
6. **JSON Schema for `bench/framework-matrix.json`.** Author
   `bench/framework-matrix.schema.json` (Draft 2020-12); validate inside `loadMatrix`
   (`bench/src/config-v4.mjs:94-136`) before the existing enum checks. New test:
   schema-validates the live matrix; rejects deliberately-broken fixtures (typo'd tier,
   string `benchmarkEnabled`, etc.).
7. **Replace hand-rolled JSONC/TOML parsing in `scripts/cloudflare-config-audit.mjs` with
   library dependencies** (`jsonc-parser` for JSONC, `@iarna/toml` or `smol-toml` for
   TOML). New fixture test: comments-in-strings and dotted keys parse correctly.
8. **Move `FRAMEWORK_VERSION_KEYS` from `bench/src/run.mjs:479-506` into matrix rows as
   `frameworks[].versionPackages: string[]`.** Loader exposes them; runner consumes from
   matrix. Test: every enabled matrix row has non-empty `versionPackages`;
   `provenance.frameworkVersions[name]` non-null for every enabled target after a run.
9. **Treat missing cloudflare audit row as an error, not `'unknown'`.** Inside
   `bench/src/run.mjs:746-763`, throw rather than fall through to
   `'cf=unknown'`. Test: removing one app's wrangler config fails the run loudly.
10. **Forbid direct reads of `bench/targets.live.json` outside `bench/src/config-v4.mjs`.**
    Add a CI grep rule (e.g., new line in `scripts/test-ci-workflows.mjs` or a dedicated
    test) that fails if any other tracked file matches `targets\.live\.json` for read.

Bugs flagged in the review but not in this top-10 list (e.g., `'ssg'` collapse to SSR
contract, custom JSONC parser corner cases, `[...BASE_SUITES]` fallback for unknown
framework) are subsumed by fixes 2, 7, and 5 respectively.

## The 4 required audits

11. **Audit `scripts/verify-results.mjs`, `scripts/smoke.mjs`, `scripts/verify-live.mjs`,
    `scripts/bench-remote.mjs`, `scripts/contract-tests.mjs`.** For each script
    determine:
    - Does it read `bench/targets.live.json` directly (regression for fix 10) or use
      `resolveLiveTargets` from `bench/src/config-v4.mjs`?
    - Does it duplicate route / selector / cache knowledge that should derive from
      `contracts/v5.json` (regression for fix 1)?
    - Does it verify `provenance.hashes.scoring` and `provenance.hashes.suites` in result
      files (gap for fixes 3 and 4)?
    Each finding is either folded into the relevant fix (extending that fix's proof test)
    or filed as a new bd issue. Audit closes with a one-line evidence note per script.
12. **Audit `bench/cloudflare-optimization-variants.json` shape.** Read the file in full;
    confirm the schema implicit in `validateOptimizationVariants` is documented or
    formalize it as a JSON Schema (same approach as fix 6). If not formalized in this
    loop, file a bd issue describing the schema gap.
13. **Audit each `apps/*` for `handleContractApi` delegation.** F-002 in
    `docs/exhaustive-logic-audit-2026-05-07.md` claims every app delegates correctly;
    verify per app by grepping each app's request entrypoint for an import of
    `handleContractApi` from `@cf-bench/bench-contract` plus an actual call site, and
    confirm no app re-implements `/api/bench`, `/api/listings`, `/api/prices`,
    `/api/media`, or `/__bench/*` paths. File a bd issue for any drift.
14. **Audit `scripts/lighthouse-compare.mjs` and `bench/src/load-test.mjs`.** Read both;
    determine whether either duplicates any authority covered by fixes 1–10 (route list,
    cache table, scenario contract, scoring rubric, target list). Fold into the relevant
    fix or file a bd issue.

## The final step

15. **Run full benchmark suite as a backgrounded task.** This step only runs after fixes
    1–10 and audits 11–14 are all complete and committed. Steps:
    - Verify the working tree is clean (`git status --porcelain` empty) so canonical
      result writes are not refused by `assertCanonicalResultWritable`
      (`bench/src/run.mjs:146-167`).
    - Kick off `pnpm bench:all` with `run_in_background: true`. Capture the bash shell
      ID for monitoring. The command runs all three suites sequentially:
      `bench` → `mpa_airbnb`, `bench:spa` → `spa_trading_media`,
      `bench:hifi` → `mpa_airbnb_hifi`.
    - Schedule the next loop tick at 1200–1800 seconds; subsequent ticks check the
      background shell's status. Do not poll faster than every 1200s — the bench is
      long-running (10 iterations × 3 profiles × ~23 frameworks × multiple scenarios
      × 2 phases per suite, plus a hifi suite at 10 iterations × `mobile-hifi` only).
    - On bench completion, verify all of:
      - Bash exit code is 0.
      - `bench/results.v4.mpa_airbnb.json`,
        `bench/results.v4.spa_trading_media.json`, and
        `bench/results.v4.mpa_airbnb_hifi.json` all exist and parse as JSON.
      - Each result's `provenance.hashes.scoring`, `provenance.hashes.suites`, and
        `provenance.hashes.contract` are non-null strings.
      - No row in any result's `rows[]` has a `bucketKeyScenario` containing
        `cf=unknown`.
      - For each suite, the result's `frameworks[].name` set equals the matrix's
        `benchmarkEnabled=true` set, intersected with hifi support for the hifi suite.
      - `pnpm verify:results <each result file>` exits 0.
    - Commit the three result files following whatever canonical-result commit policy
      the repo follows (markdown summaries are co-emitted; commit them too).
    - Only then declare the loop complete.

Nothing remains out of scope; the original review's residual-risk list is fully covered
by audits 11–14.

---

Completion rule:
The loop is complete only when the objective is fully satisfied against real evidence. If
complete, report completion and do not schedule another loop tick.

Each tick:
1. Reconstruct the current state from files, commands, CI, browser/runtime output, or
   other real evidence.
2. Build a checklist from every explicit requirement in the objective.
3. Mark each checklist item as complete, incomplete, blocked, or unverified.
4. If all required items are complete and verified, stop the loop.
5. If blocked, report the exact blocker and stop unless there is a concrete future event
   worth waiting for.
6. If work remains and is actionable, do the next highest-value step.
7. Before ending the tick, schedule the next dynamic loop tick only if work remains.

Do not:
- treat partial implementation as completion
- rely on memory alone
- reschedule after completion
- keep looping when blocked without a concrete wait condition

---

## Per-tick reconstruction map

For each item, the tick should grep / read these specific locations to determine state.
Anything in the "incomplete" column means the item is not done; "complete" describes
the post-state.

| #  | Item                              | Look for (incomplete signal)                                                                                                                                  | Look for (complete signal)                                                                                          |
|----|-----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| 1  | `contracts/v5.json`               | `requiredTestIdsForRoute` switch in `scripts/contract-report.mjs`; `CONTRACT_ROUTES` literal in `scripts/cloudflare-config-audit.mjs`                          | `contracts/v5.json` exists; both scripts import from it; `provenance.hashes.contractsJson` present                  |
| 2  | drop `DEFAULT_SCENARIOS`          | `DEFAULT_SCENARIOS` or `fallbackScenarioContractForType` in `bench/src/run.mjs`                                                                               | grep finds 0 occurrences; `run.mjs` throws on missing `config.scenarios`                                            |
| 3  | scoring rubric file               | inline literal `'real-world-choice-v1'` in `bench/src/run.mjs` outside a single loader call                                                                   | `bench/scoring-rubric.json` exists; `provenance.hashes.scoring` present in latest canonical result                  |
| 4  | hash suites                       | `provenance.hashes.suites` absent in latest canonical result file                                                                                             | hash present and changes when a suite file is mutated                                                               |
| 5  | generated HIFI list               | `HIFI_SUITE_FRAMEWORKS = [` literal in `packages/bench-contract/src/index.js`                                                                                  | imported from a generated module; CI test verifies parity with matrix                                               |
| 6  | matrix schema                     | `bench/framework-matrix.schema.json` absent; `loadMatrix` does not invoke a schema validator                                                                  | schema present; loader rejects broken fixtures in unit test                                                         |
| 7  | library JSONC/TOML                | `jsonc-parser` and TOML lib absent from `package.json` deps; custom stripper still in `scripts/cloudflare-config-audit.mjs`                                   | deps present; custom stripper deleted; comments-in-strings fixture test passes                                      |
| 8  | `versionPackages` in matrix       | `FRAMEWORK_VERSION_KEYS` in `bench/src/run.mjs`                                                                                                                | constant deleted; matrix rows carry `versionPackages`; runner reads from row                                        |
| 9  | strict cloudflare audit           | `'unknown'` segment ever appears in `bucketKeyScenario` for any enabled framework in latest canonical result                                                   | runner throws when audit row missing; no `cf=unknown` segments                                                      |
| 10 | forbid direct targets reads       | grep `targets\.live\.json` finds reads outside `bench/src/config-v4.mjs`                                                                                       | only `config-v4.mjs` reads it; CI test enforces rule                                                                |
| 11 | audit verify/smoke/live scripts   | no bd issue or commit note recording the audit findings                                                                                                        | per-script one-line evidence note exists; any drift folded into fix 1/10 or filed as bd                             |
| 12 | audit optimization-variants JSON  | no schema or bd issue describing the catalog's expected shape                                                                                                  | schema present OR bd issue filed                                                                                    |
| 13 | audit `apps/*` delegation         | no per-app evidence note; or any app re-implementing `/api/bench`, `/api/listings`, `/api/prices`, `/api/media`                                                | each app shows `handleContractApi` import + call; no re-implementations                                             |
| 14 | audit lighthouse + load-test      | no bd issue or commit note; or duplicated authority found and unfiled                                                                                          | evidence note exists; any drift folded into fixes 1–10 or filed as bd                                               |
| 15 | full bench run                    | three result files missing or older than the latest fix commit; `provenance.hashes.scoring` or `.suites` missing in any of them                                | three result files newer than HEAD~1; all three pass post-bench verification (see below)                            |

## Verification commands per tick

Run the relevant subset based on which fixes/audits the tick is closing. All commands
relative to repo root.

```
pnpm test:contracts                       # 1, 4
pnpm cloudflare:config-audit              # 7, 10
pnpm cloudflare:optimization-audit        # general regression, 12
pnpm contract:report                      # 1, 5 (against live)
pnpm test:bench-runner                    # 2, 3, 6, 8, 9
pnpm test:cloudflare-config               # 7
pnpm test:bench-contract                  # 5
pnpm verify:results <latest result>       # 3, 4, 8, 9 (provenance presence)
```

Final-step commands (only after items 1–14 are all complete):

```
git status --porcelain                    # must be empty (canonical-write precondition)
pnpm bench:all                            # backgrounded; produces three result files
pnpm verify:results bench/results.v4.mpa_airbnb.json
pnpm verify:results bench/results.v4.spa_trading_media.json
pnpm verify:results bench/results.v4.mpa_airbnb_hifi.json
```

If a fix prescribes a new test, that test must be tracked (committed `.mjs` script
referenced from `package.json` scripts table) and pass.

## Issue tracking

Every fix and every audit should have a beads issue (`bd create`) before work begins;
close on the same commit as the fix or audit evidence note. The bd state is part of the
tick's "reconstruct current state" — `bd ready` and `bd list --status=open` indicate
which items remain. The final benchmark run gets its own bd issue too, opened only when
items 1–14 are all closed.

## Background bench monitoring

The final-step `pnpm bench:all` is a long-running command (canonical runs are typically
hours: 10 iterations × 3 profiles × ~23 frameworks × 5–7 scenarios × 2 phases per suite,
times 3 suites, with the hifi suite at `mobile-hifi` only). The loop tick that kicks it
off MUST:

1. Use `Bash` with `run_in_background: true`.
2. Record the returned shell ID in a stable place (this `loop.md` is fine; append a line
   under `## Background bench shell` at the bottom of the file with the shell ID and
   start timestamp).
3. Schedule the next tick at 1200–1800 seconds via `ScheduleWakeup` (per the dynamic-loop
   contract). Cache windows: 1200s amortizes the cache-miss across long waits; do not
   default to 300s.
4. On the next tick, read the recorded shell ID, check status (running vs exited).
5. If still running, schedule another 1200–1800s tick.
6. If exited successfully, run the post-bench verification list above and, if everything
   passes, declare loop complete and do not schedule another tick.
7. If exited non-zero, capture the failing tail of stdout/stderr, record it in the bd
   issue for item 15, mark blocked unless a concrete fix is actionable, and stop
   scheduling.

---

## Source: architectural review (2026-05-08)

The objective above was extracted from this review; the review itself is the underlying
authority for the per-concern detail behind each fix and audit.

### Hidden authority structure

Declarative-truth core: `bench/framework-matrix.json` + `bench/suites/*.json` +
`bench/targets.live.json` + `docs/contracts-v5.md` + `docs/contracts-v6-addendum.md` +
`bench/cloudflare-platform-eras.json`. `bench/src/config-v4.mjs` is the only correct
loader (validates enums at `:12-15`, refuses Pages at `:182-184`, merges defaults at
`:114-117`).

Three large files re-state the same facts in code: `bench/src/run.mjs` (114KB),
`scripts/contract-report.mjs`, `scripts/cloudflare-config-audit.mjs`. Each carries its
own copy of the route list, scenario taxonomy, cache table, selector table, or scoring
rubric. Apps subordinate via `packages/bench-contract/src/index.js#handleContractApi`,
with one runtime duplication: `HIFI_SUITE_FRAMEWORKS` literal at `:22-44`.

`bench/src/run-v4.mjs` is the canonical entrypoint per `package.json:37-46`. It loads
suite + targets, runs `contract-report.mjs --fail-on-violations` as a gate
(`bench/src/run-v4.mjs:252-253`), then spawns `bench/src/run.mjs`.

### Per-concern audit summary

| #  | Concern                              | Today's authority                                                  | Greenfield home                          | Bypasses                                                                                  |
|----|--------------------------------------|--------------------------------------------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------|
| 1  | Framework eligibility (tier/hifi)    | matrix; `config-v4.mjs:107-135`, `:176-184`                        | matrix                                   | `packages/bench-contract/src/index.js:22-44` literal                                      |
| 2  | Scenario contract                    | matrix `benchmarkDefaults.scenarioContracts` + per-row override    | matrix only                              | `run.mjs:673-708` `DEFAULT_SCENARIOS`; `:719-724` fallback; `run-v4.mjs:57-70` 3rd copy   |
| 3  | Routes / selectors / cache           | docs + suites + `contract-report.mjs:49-98` + `config-audit.mjs:132` | single `contracts/v5.json`                | `CONTRACT_ROUTES` literal hardcodes `/blog/why-this-benchmark-exists`                     |
| 4  | API contract handler                 | `packages/bench-contract/src/index.js#handleContractApi:167-180`   | same                                     | `:73` empty fallback for missing framework                                                |
| 5  | Live target enforcement              | `bench/src/config-v4.mjs#resolveLiveTargets:144-201`               | same                                     | direct reads of `targets.live.json` from ad-hoc scripts                                   |
| 6  | Scoring rubric                       | inline `bench/src/run.mjs:2135-2155`                               | `bench/scoring-rubric.json`              | rubric not in provenance hashes                                                           |
| 7  | Bucketing                            | `run.mjs:733-744`, `:746-763`                                      | rubric file                              | `'unknown'` cf-mode silently disqualifies framework                                       |
| 8  | Run-order / provenance               | `run.mjs:1751-1758`, `:269-285`, `:2460-2478`                      | same                                     | suites and rubric not hashed                                                              |
| 9  | Anti-gaming controls                 | `run.mjs:146-167`; `run-v4.mjs:129-162`; `run.mjs:2170-2183`       | same                                     | provenance gaps from concerns 6, 8                                                        |
| 10 | Cloudflare config audit              | `scripts/cloudflare-config-audit.mjs`                              | same with library deps                   | hand-rolled JSONC/TOML parsers                                                            |
| 11 | Cloudflare optimization audit        | `scripts/cloudflare-optimization-audit.mjs`                        | same                                     | variant catalog hashed only transitively                                                  |
| 12 | Framework version capture            | `run.mjs:479-506` `FRAMEWORK_VERSION_KEYS`                         | matrix `versionPackages`                 | new framework requires `run.mjs` edit                                                     |
| 13 | Matrix schema                        | implicit; `config-v4.mjs:62-92, 107-135` enums only                | `framework-matrix.schema.json`           | typos / wrong types pass validation                                                       |
| 14 | Result file shape                    | implicit at `run.mjs:2484-2540`                                    | `results.v4.schema.json`                 | adding/removing fields uncoordinated                                                      |

### Bugs flagged

- `fallbackScenarioContractForType` collapses `'ssg'` to SSR contract
  (`run.mjs:719-724`). Dormant but real; subsumed by fix 2.
- Provenance contract hash omits scoring rubric and suite JSONs. Real today; fixes 3, 4.
- `packages/bench-contract/src/index.js:73` returns empty `[...BASE_SUITES]` for unknown
  framework. Subsumed by fix 5 (mandatory framework + generated HIFI list).
- `CONTRACT_ROUTES` at `scripts/cloudflare-config-audit.mjs:132` hardcodes the blog slug
  `/blog/why-this-benchmark-exists`. Subsumed by fix 1.
- Custom JSONC stripper / TOML parser in `cloudflare-config-audit.mjs` is silently
  fragile on edge cases. Subsumed by fix 7.

### Audit coverage of original residual risks

- `scripts/verify-results.mjs`, `scripts/smoke.mjs`, `scripts/verify-live.mjs`,
  `scripts/bench-remote.mjs`, `scripts/contract-tests.mjs` → audit 11.
- `bench/cloudflare-optimization-variants.json` shape → audit 12.
- 23 `apps/*` delegation to `handleContractApi` → audit 13.
- `scripts/lighthouse-compare.mjs`, `bench/src/load-test.mjs` → audit 14.

---

## Background bench shell

(Populated by the tick that kicks off `pnpm bench:all`; one line per attempt.)

- shell `bqa1j0ju4` started 2026-05-07T18:30:09Z (`pnpm bench:all` — mpa_airbnb → spa_trading_media → mpa_airbnb_hifi)

