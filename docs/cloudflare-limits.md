# Cloudflare Free-Tier Limits (Workers)

This benchmark targets Cloudflare Workers on the free tier. These limits affect how results should be interpreted:

- CPU time per request is limited (typically ~10ms). SSR-heavy routes can hit this ceiling under load.
- Script size limits apply to the worker bundle. Large frameworks can get closer to the cap.
- Some platform features (KV/D1/etc.) are restricted or require paid plans.

Notes:
- Bench results include `server-timing` values and isolate IDs where available. Spikes or error rates may indicate CPU time limits.
- If a framework routinely exceeds limits, results should be treated as "invalid for free tier" and bucketed separately.
