/**
 * A real but small change must not read as "0%": a few rain gardens in a
 * dense district move runoff by fractions of a percent, and rounding that to
 * zero tells the visitor nothing happened when the volumes below say it did.
 */
export function percentChange(percent: number): string {
  const magnitude = Math.abs(percent);
  if (magnitude >= 1) return String(Math.round(magnitude));
  if (magnitude >= 0.05) return magnitude.toFixed(1);
  return "<0.1";
}
