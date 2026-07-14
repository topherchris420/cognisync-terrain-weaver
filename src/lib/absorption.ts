import type { FloodRisk, LandCover, LandCoverKey } from "./types";

/**
 * Urban Absorption Score
 *
 * The share of rainfall the LAND in a tile can absorb or delay, 0-100.
 *
 * ## The weights are runoff coefficients, not opinions
 *
 * Each weight is `1 - C`, where `C` is the Rational Method runoff coefficient
 * (Q = CiA) — the coefficient used in actual stormwater drainage design.
 * Representative mid-range values for urban land cover, after ASCE and
 * Chow/Maidment/Mays, *Applied Hydrology*:
 *
 * | Surface                     | C range     | taken | absorbs |
 * |-----------------------------|-------------|-------|---------|
 * | Lawns & woodland, urban     | 0.05 – 0.25 | 0.20  | 0.80    |
 * | Bare / compacted urban soil | 0.20 – 0.40 | 0.30  | 0.70    |
 * | Roofs                       | 0.75 – 0.95 | 0.90  | 0.10    |
 * | Asphalt & concrete          | 0.70 – 0.95 | 0.88  | 0.12    |
 *
 * Vegetation is deliberately NOT 1.0. No surface absorbs all the rain that
 * falls on it; even woodland on sandy soil sheds 5-25%.
 *
 * ## Open water is excluded, on purpose
 *
 * Water carries no weight and is removed from the denominator. Open water is
 * not absorption capacity — it is the body that *receives* the runoff. Treating
 * a river as a half-strength sponge (as this model previously did) rewards a
 * site for being flood-exposed: the Port of Rotterdam scored 45.8 ("moderate")
 * against 36.5 ("high") for a leafy Berlin residential district, purely because
 * 45% of its frame was harbour. Lower Manhattan does not flood less because the
 * Hudson is there; during Sandy it flooded because the Hudson was there.
 *
 * So the score answers: *of the land here, how much rain can it take?*
 * The water fraction is still reported — it is real, and it matters — but it is
 * reported as water, not as absorption.
 *
 * ## Calibration
 *
 * Bands were set against 18 real scans spanning the density spectrum, from
 * Bois de Boulogne (74.7) to Midtown Manhattan (14.0). See
 * `docs/absorption-calibration.md`.
 */
export const ABSORPTION_WEIGHTS: Record<
  Exclude<LandCoverKey, "water">,
  number
> = {
  vegetation: 0.8,
  soil: 0.7,
  buildings: 0.1,
  pavement: 0.12,
};

/** The classes that contribute absorption. Water is land-cover, not sponge. */
const ABSORBING: Array<Exclude<LandCoverKey, "water">> = [
  "vegetation",
  "soil",
  "buildings",
  "pavement",
];

export function computeAbsorptionScore(cover: LandCover): number {
  // Denominator is LAND only. A tile that is 45% harbour is scored on the 55%
  // that could actually absorb something.
  const land = ABSORBING.reduce((sum, k) => sum + (Number(cover[k]) || 0), 0);
  if (land <= 0) return 0;

  const absorbed = ABSORBING.reduce(
    (sum, k) => sum + (Number(cover[k]) || 0) * ABSORPTION_WEIGHTS[k],
    0
  );

  return Math.round((absorbed / land) * 100 * 10) / 10;
}

/**
 * Flood-risk bands.
 *
 * Physically meaningful, and checked against the 18-site calibration set:
 *
 *   >= 55  the land takes most of the rain that falls on it
 *   35-54  roughly half runs off; the drainage network carries the rest
 *   <  35  two thirds or more runs off; the site depends entirely on drainage
 *
 * These are deliberately not tuned to give a flattering spread. Most urban land
 * really is mostly impervious, and most of the calibration set really does land
 * in "moderate" or "high". That is the finding, not a defect.
 */
export const RISK_BANDS = { moderate: 35, low: 55 } as const;

export function classifyFloodRisk(score: number): FloodRisk {
  if (score >= RISK_BANDS.low) return "low";
  if (score >= RISK_BANDS.moderate) return "moderate";
  if (score >= 0) return "high";
  return "unknown";
}

export function riskColor(risk: FloodRisk): string {
  switch (risk) {
    case "low":
      return "text-primary";
    case "moderate":
      return "text-warning";
    case "high":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export function riskLabel(risk: FloodRisk): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}
