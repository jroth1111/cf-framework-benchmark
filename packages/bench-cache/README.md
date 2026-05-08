# @cf-bench/bench-cache

Single source of cache-control header values for benchmark-contract routes.
Reads canonical idiomatic-profile values from `contracts/v5.json` and applies
the bench-profile downgrade policy (parity → `no-store` for non-hifi cacheable
HTML routes; hifi routes always emit the rich header so the hifi suite
measures cached responses).

Every emitter in this monorepo (per-app HTML wrappers, the OpenNext patcher,
the bench-contract API package, scripts/contract-tests.mjs) reads from this
package. The proof test `scripts/test-cache-derivation.mjs` enforces that no
`s-maxage=`/`stale-while-revalidate`/`no-store` literal lives outside this
package or the v5 contract files.
