export function interactionMs(s) {
  const values = [s.inp?.p50, s.chartSwitchMs?.p50, s.chartDrawMs?.p50].filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
