import type { FloodRisk, LandCover } from "./types";

/**
 * Urban Absorption Score
 *
 * Weighted percentage of the analyzed area that can absorb or delay stormwater.
 * The weights mirror simplified runoff coefficients used in urban hydrology:
 * - vegetation absorbs the most rainfall
 * - bare soil is permeable but variable
 * - open water represents existing hydro capacity, capped at 0.5 for scoring
 *   (it doesn't add absorption capacity, but it isn't runoff either)
 * - buildings and pavement are effectively impervious
 *
 * Returns a 0-100 score.
 */
export const ABSORPTION_WEIGHTS: Record<keyof LandCover, number> = {
  vegetation: 1.0,
  soil: 0.85,
  water: 0.5,
  buildings: 0.05,
  pavement: 0.05,
};

export function computeAbsorptionScore(cover: LandCover): number {
  const total = Object.values(cover).reduce((a, b) => a + b, 0) || 1;
  const raw =
    Object.entries(cover).reduce((sum, [key, pct]) => {
      const weight = ABSORPTION_WEIGHTS[key as keyof LandCover] ?? 0;
      return sum + pct * weight;
    }, 0) / total;
  // raw is 0..1 (roughly), scale to 0..100
  return Math.round(raw * 100 * 10) / 10;
}

export function classifyFloodRisk(score: number): FloodRisk {
  if (score >= 65) return "low";
  if (score >= 40) return "moderate";
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
