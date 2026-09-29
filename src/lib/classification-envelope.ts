import { computeAbsorptionScore } from "./absorption";
import { compareStorm } from "./paired-storm";
import { EMPTY_SCENARIO, INTERVENTIONS, INTERVENTION_ORDER, siteCoverShares, type Scenario } from "./scenario";
import { landCoverSensitivity } from "./land-cover-sensitivity";
import type { LandCover } from "./types";

/**
 * Propagates classification uncertainty through score, bulk runoff and a
 * counterfactual, so a user can see whether a conclusion survives it.
 *
 * This is a sensitivity range derived from measured classifier behaviour, not
 * a statistical confidence interval: it asks "what if the pervious share is
 * off by the amount we have observed it to be off?", one assumption at a time.
 */
export interface ClassificationErrorRange {
  /** Percentage points of the frame moved between vegetation and pavement. */
  pp: number;
  kind: "benchmark-derived" | "repeat-run" | "user-selected";
  label: string;
  source: string;
}

export interface EnvelopeRow {
  shiftPP: number;
  cover: LandCover;
  score: number;
  nowRunoffM3: number;
  possibleRunoffM3: number;
  reductionPercent: number;
}

/** Converted area (m²) per intervention, fixed by the plan rather than by the cover estimate. */
export function scenarioAreas(cover: LandCover, scenario: Scenario, areaM2: number): Record<string, number> {
  const shares = siteCoverShares(cover);
  return Object.fromEntries(INTERVENTION_ORDER.map((key) => [key, areaM2 * shares[INTERVENTIONS[key].source] * (scenario[key] || 0)]));
}

/** The same built area expressed against a different cover estimate, capped by available source surface. */
export function scenarioForAreas(cover: LandCover, areas: Record<string, number>, areaM2: number): Scenario {
  const shares = siteCoverShares(cover);
  const out = { ...EMPTY_SCENARIO };
  for (const key of INTERVENTION_ORDER) {
    const available = areaM2 * shares[INTERVENTIONS[key].source];
    out[key] = available > 0 ? Math.min(1, (areas[key] ?? 0) / available) : 0;
  }
  return out;
}

export function classificationEnvelope(
  cover: LandCover,
  areaM2: number,
  rainfallMm: number,
  range: ClassificationErrorRange,
  scenario: Scenario = EMPTY_SCENARIO,
) {
  const built = scenarioAreas(cover, scenario, areaM2);
  const rows: EnvelopeRow[] = landCoverSensitivity(cover, areaM2, rainfallMm, range.pp).map((row) => {
    const storm = compareStorm(row.cover, scenarioForAreas(row.cover, built, areaM2), areaM2, rainfallMm);
    return {
      shiftPP: row.shiftPP,
      cover: row.cover,
      score: computeAbsorptionScore(row.cover),
      nowRunoffM3: storm.now.runoffM3,
      possibleRunoffM3: storm.possible.runoffM3,
      reductionPercent: storm.runoffReductionPercent,
    };
  });
  const span = (f: (r: EnvelopeRow) => number) => ({ min: Math.min(...rows.map(f)), max: Math.max(...rows.map(f)), central: f(rows[1]) });
  return {
    range,
    rows,
    pavementPercent: span((r) => r.cover.pavement),
    score: span((r) => r.score),
    nowRunoffM3: span((r) => r.nowRunoffM3),
    possibleRunoffM3: span((r) => r.possibleRunoffM3),
    reductionPercent: span((r) => r.reductionPercent),
  };
}
