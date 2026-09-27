/** Shared contract for percentages supplied by people, classifiers and MCP tools. */
export const LAND_COVER_KEYS = [
  "vegetation",
  "soil",
  "buildings",
  "pavement",
  "water",
] as const;
export type ValidLandCover = Record<(typeof LAND_COVER_KEYS)[number], number>;
export function validateLandCover(value: unknown): ValidLandCover {
  if (!value || typeof value !== "object")
    throw new Error("A complete land-cover composition is required.");
  const raw = value as Record<string, unknown>;
  const cover = {} as ValidLandCover;
  for (const key of LAND_COVER_KEYS) {
    const v = raw[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)
      throw new Error(`Invalid land-cover percentage: ${key}.`);
    cover[key] = v;
  }
  const total = LAND_COVER_KEYS.reduce((sum, key) => sum + cover[key], 0);
  // Accept only decimal rounding drift, never salvage an incomplete classification.
  if (Math.abs(total - 100) > 0.5)
    throw new Error(
      "Land-cover percentages must sum to 100 (within 0.5 percentage points).",
    );
  return cover;
}
