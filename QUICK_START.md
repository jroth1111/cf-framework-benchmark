# Quick Start - Before Running Benchmark

## 1. Install Dependencies (2 min)
```bash
pnpm install
```

## 2. Test One Framework (3 min)

Start React Vite dev server:
```bash
pnpm -C apps/react-vite dev
```

Then visit: **http://localhost:5173/chart**

**What to check:**
- [ ] Chart loads and shows candles
- [ ] Can change symbol (BTC, ETH, SOL)
- [ ] Can change timeframe (1h, 4h, 1d)
- [ ] Can toggle indicators (SMA20, SMA50, etc.)
- [ ] Can drag to pan
- [ ] Can scroll to zoom

## 3. Build All Apps (5 min)

```bash
# Build each app
pnpm -C apps/react-vite build
pnpm -C apps/react-spa build
pnpm -C apps/nextjs build
pnpm -C apps/tanstack-start build
pnpm -C apps/solid build
pnpm -C apps/sveltekit build
pnpm -C apps/qwik build
```

## 4. Run Contract Tests (1 min)

```bash
pnpm test:contracts
```

**Expected output:** `Contract tests passed.`

## 5. Run Smoke Test (2 min)

```bash
pnpm bench:smoke
```

This runs 1 iteration to verify everything works.

## 6. Run Full Benchmark (15-30 min)

```bash
# Default: 10 iterations, parity profile
pnpm bench

# More iterations
pnpm bench --iterations 20

# Different profile
pnpm bench --profile idiomatic
```

---

## Summary

| Step | Command | Time |
|-------|----------|-------|
| Install | `pnpm install` | 2 min |
| Test one | `pnpm -C apps/react-vite dev` | 3 min |
| Build all | `pnpm -C apps/*/build` | 5 min |
| Contracts | `pnpm test:contracts` | 1 min |
| Smoke test | `pnpm bench:smoke` | 2 min |
| **Full benchmark** | `pnpm bench` | 15-30 min |

**Total time before full benchmark:** ~15 minutes

---

## If Something Fails

### Build errors
```bash
# Check TypeScript
pnpm -C apps/react-vite exec npx tsc --noEmit --skipLibCheck
```

### Contract test fails
- Check which endpoint is failing
- Verify API routes are working

### Chart not loading
- Open browser DevTools console
- Check for JavaScript errors
- Verify `/api/prices` returns data

### Benchmark times out
- Increase timeout in `bench/bench.config.json`
- Check if all dev servers are running
