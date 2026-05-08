#!/usr/bin/env node
import assert from "node:assert/strict";
import { interactionMs } from "../bench/src/metrics.mjs";
import { effectiveMetricWeight, loadScoringRubric } from "../bench/src/run.mjs";

// interactionMs: averages non-null p50 values from inp, chartSwitchMs, chartDrawMs.
// Returns null when no finite values exist.
{
  // All three present
  assert.equal(
    interactionMs({ inp: { p50: 100 }, chartSwitchMs: { p50: 50 }, chartDrawMs: { p50: 30 } }),
    60,
    "interactionMs must average all available p50 values"
  );

  // Only inp
  assert.equal(
    interactionMs({ inp: { p50: 100 } }),
    100,
    "interactionMs with inp only must return inp.p50"
  );

  // inp + chartSwitch only
  assert.equal(
    interactionMs({ inp: { p50: 80 }, chartSwitchMs: { p50: 40 } }),
    60,
    "interactionMs with two values must average them"
  );

  // No values
  assert.equal(
    interactionMs({}),
    null,
    "interactionMs with no values must return null"
  );

  // p50 is NaN (treated as missing)
  assert.equal(
    interactionMs({ inp: { p50: NaN } }),
    null,
    "interactionMs must treat NaN as missing"
  );

  // p50 is Infinity (not finite, treated as missing)
  assert.equal(
    interactionMs({ inp: { p50: Infinity } }),
    null,
    "interactionMs must treat Infinity as missing"
  );

  // Mixed: some present, some missing
  assert.equal(
    interactionMs({ inp: { p50: 100 }, chartSwitchMs: { p50: null }, chartDrawMs: { p50: 200 } }),
    150,
    "interactionMs must average only finite p50 values"
  );

  // Zero values are valid
  assert.equal(
    interactionMs({ inp: { p50: 0 }, chartDrawMs: { p50: 0 } }),
    0,
    "interactionMs must accept zero as a valid value"
  );

  // Negative values are valid (for completeness)
  assert.equal(
    interactionMs({ inp: { p50: -10 } }),
    -10,
    "interactionMs must accept negative values"
  );
}

// effectiveMetricWeight: resolves per-profile metric weights from the scoring rubric.
// Profile-specific overrides take precedence; `*` is catch-all; base weights are fallback.
{
  const rubric = loadScoringRubric();
  const base = rubric.metricWeights;

  // Base weights for mobile-cold (empty override, falls through to base)
  for (const [metric, expected] of Object.entries(base)) {
    assert.equal(
      effectiveMetricWeight(metric, "mobile-cold", rubric),
      expected,
      `mobile-cold must use base weight for ${metric}`
    );
  }

  // `*` overrides for parity and idiomatic
  const starOverride = rubric.profileMetricWeights["*"];
  for (const [metric, override] of Object.entries(starOverride)) {
    assert.equal(
      effectiveMetricWeight(metric, "parity", rubric),
      override,
      `parity must use * override for ${metric}`
    );
    assert.equal(
      effectiveMetricWeight(metric, "idiomatic", rubric),
      override,
      `idiomatic must use * override for ${metric}`
    );
  }

  // Non-overridden metrics fall through to base for * profiles
  for (const [metric, baseWeight] of Object.entries(base)) {
    if (!(metric in starOverride)) {
      assert.equal(
        effectiveMetricWeight(metric, "parity", rubric),
        baseWeight,
        `parity must fall through to base for non-overridden ${metric}`
      );
    }
  }

  // Unknown metric returns 0
  assert.equal(
    effectiveMetricWeight("nonexistent_metric", "parity", rubric),
    0,
    "unknown metric must return 0"
  );

  // Unknown profile uses * catch-all
  assert.equal(
    effectiveMetricWeight("lcp", "unknown_profile", rubric),
    starOverride.lcp,
    "unknown profile must use * catch-all"
  );

  // All effective weights for each profile sum to 1.0
  const allMetrics = [...new Set([...Object.keys(base), ...Object.keys(starOverride)])];
  for (const profile of ["parity", "idiomatic", "mobile-cold"]) {
    const sum = allMetrics.reduce((s, m) => s + effectiveMetricWeight(m, profile, rubric), 0);
    assert.ok(
      Math.abs(sum - 1) < 1e-6,
      `${profile} effective weights must sum to 1.0 (got ${sum})`
    );
  }
}

console.log("scoring-metrics regression tests passed");
