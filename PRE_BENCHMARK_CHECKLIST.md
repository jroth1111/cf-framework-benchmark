# Pre-Benchmark Checklist

## ✅ Step 1: Install Dependencies

```bash
pnpm install
```

This should complete without errors.

---

## ✅ Step 2: Build Shared Packages

```bash
# Build type definitions
pnpm -C packages/bench-types exec npx tsc
pnpm -C packages/bench-config exec npx tsc
pnpm -C packages/chart-hooks exec npx tsc --skipLibCheck
```

**Expected:** All commands complete successfully (minor errors about missing qwik/solid/svelte types are OK since they're optional).

---

## ✅ Step 3: Build One App to Test

### Test React Vite (Recommended to test first)
```bash
pnpm -C apps/react-vite build
```

### Or run dev server:
```bash
pnpm -C apps/react-vite dev
```

Then visit: http://localhost:5173/chart

**Verify:**
- [ ] Chart loads without errors
- [ ] Can change symbol (BTC → ETH → SOL)
- [ ] Can change timeframe (1h → 4h → 1d)
- [ ] Can toggle indicators (SMA20, SMA50, EMA20, Volume)
- [ ] Canvas renders candles
- [ ] Pan works (drag)
- [ ] Zoom works (scroll wheel)
- [ ] No console errors

---

## ✅ Step 4: Build All Apps

```bash
# Build all apps sequentially
pnpm -C apps/react-vite build
pnpm -C apps/react-spa build
pnpm -C apps/nextjs build
pnpm -C apps/tanstack-start build
pnpm -C apps/solid build
pnpm -C apps/sveltekit build
pnpm -C apps/qwik build
```

**Expected:** Each app should build successfully.

---

## ✅ Step 5: Run Contract Tests

```bash
# Ensure all API contracts are still met
pnpm test:contracts
```

**Expected:** `Contract tests passed.`

---

## ✅ Step 6: Quick Smoke Test

```bash
# Run 1 iteration of benchmark (no warmup)
pnpm bench:smoke
```

This will:
- Load each framework
- Navigate to /chart
- Verify chart renders
- Record metrics

**Expected:** No critical errors, all frameworks complete.

---

## ✅ Step 7: Check Benchmark Config

Verify `bench/bench.config.json` has all framework URLs configured:

```json
{
  "frameworks": [
    {
      "name": "react-vite",
      "url": "http://localhost:5173"
    },
    {
      "name": "react-spa", 
      "url": "http://localhost:5174"
    },
    // ... etc
  ]
}
```

---

## 🔍 Common Issues & Solutions

### Issue: "Cannot find module '@cf-bench/bench-types'"

**Solution:**
```bash
pnpm install
```

### Issue: "TS2307: Cannot find module 'solid-js'"

**Solution:** This is expected when compiling `packages/chart-hooks` since Solid is an optional peer dependency. It's OK to ignore these errors with `--skipLibCheck`.

### Issue: Chart doesn't render

**Solutions:**
1. Check browser console for errors
2. Verify `/api/prices` is returning data
3. Check that `chart-core` is loading
4. Ensure canvas element is found

### Issue: Benchmark times out

**Solutions:**
1. Increase timeout in `bench/bench.config.json`
2. Check if dev server is running
3. Verify firewall isn't blocking connections

---

## 📊 Before Running Full Benchmark

### Recommended Workflow:

1. **Start all dev servers in parallel:**
```bash
# Terminal 1
pnpm -C apps/react-vite dev

# Terminal 2  
pnpm -C apps/react-spa dev

# Terminal 3
pnpm -C apps/nextjs dev

# ... etc for all frameworks
```

2. **Test each framework manually**
   - Visit http://localhost:PORT/chart
   - Verify chart loads
   - Check no console errors

3. **Run contract tests:**
```bash
pnpm test:contracts
```

4. **Run smoke test:**
```bash
pnpm bench:smoke
```

5. **Run full benchmark:**
```bash
pnpm bench
```

---

## 🎯 Verification Checklist

Before running full benchmark, verify:

- [ ] All apps build successfully
- [ ] All apps start on their ports
- [ ] Chart page loads in all frameworks
- [ ] Chart interactive (pan, zoom, toggle indicators)
- [ ] No console errors
- [ ] Contract tests pass
- [ ] Smoke test passes
- [ ] Benchmark config has correct URLs

---

## 🚀 Ready to Run Full Benchmark

```bash
# Run default benchmark (parity profile, 10 iterations)
pnpm bench

# Or with specific profile
pnpm bench --profile idiomatic

# Or run with more iterations
pnpm bench --iterations 20
```

---

## 📈 After Benchmark

Check results in:
- `bench/results/<timestamp>/` - Raw metrics
- `bench/results/latest.json` - Symlink to latest results

Open `latest.json` to view metrics.

---

## 🐛 Troubleshooting

### App won't build
Check TypeScript errors:
```bash
pnpm -C apps/<app-name> exec npx tsc --noEmit
```

### Contract tests fail
```bash
pnpm test:contracts
# Read error messages to see which endpoint is failing
```

### Chart not rendering in specific framework
- Check if framework is using correct hook (React vs Solid vs Svelte)
- Verify canvas element has correct `data-testid`
- Check browser console for errors
