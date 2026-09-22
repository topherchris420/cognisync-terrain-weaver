import { ABSORPTION_WEIGHTS } from "./absorption";
import { INTERVENTIONS, INTERVENTION_ORDER, normalizeScenario, type Scenario } from "./scenario";
import type { LandCover } from "./types";

const LAND = ["vegetation", "soil", "buildings", "pavement"] as const;
export const STORM_DEPTHS_MM = [10, 25, 50, 100, 200] as const;
export const STORM_PROVENANCE = {
  model: "land-budget-v1",
  method: "Rainfall depth × land area × fixed surface coefficients",
  coefficients: "Urban Absorption Score weights and Scenario Studio intervention weights",
  limitations: "Bulk planning estimate; excludes open water, saturation, terrain, drainage and storm timing. Independent of the routed storm simulation; does not predict flood depth or peak discharge.",
} as const;

const nonnegative = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;

export interface StormBudget {
  retentionFraction: number;
  retainedM3: number;
  runoffM3: number;
}

/** A deterministic, spatially lumped comparison. Coefficients are constant
 * across depths, so this is a sensitivity calculation, not capacity design. */
export function compareStorm(cover: LandCover, scenario: Scenario, areaM2: number, rainfallMm: number) {
  // Scale before summing to avoid overflow and accept percentages or fractions.
  const scale = Math.max(...Object.values(cover).map(nonnegative), 1);
  const land = LAND.reduce((sum, key) => sum + nonnegative(cover[key]) / scale, 0);
  const total = land + nonnegative(cover.water) / scale;
  const landAreaM2 = total > 0 ? nonnegative(areaM2) * (land / total) : 0;
  const rain = nonnegative(rainfallMm);
  const volume = landAreaM2 * (rain / 1000);
  const rainfallVolumeM3 = Number.isFinite(volume) ? volume : 0;
  const base = land > 0 ? LAND.reduce((sum, key) => sum + (nonnegative(cover[key]) / scale / land) * ABSORPTION_WEIGHTS[key], 0) : 0;
  const normalized = normalizeScenario(scenario);
  const added = land > 0 ? INTERVENTION_ORDER.reduce((sum, key) => {
    const def = INTERVENTIONS[key];
    return sum + nonnegative(cover[def.source]) / scale / land * normalized[key] * (def.targetWeight - ABSORPTION_WEIGHTS[def.source]);
  }, 0) : 0;
  const budget = (fraction: number): StormBudget => {
    const retentionFraction = Math.max(0, Math.min(1, fraction));
    const retainedM3 = rainfallVolumeM3 * retentionFraction;
    return { retentionFraction, retainedM3, runoffM3: rainfallVolumeM3 - retainedM3 };
  };
  const now = budget(base);
  const possible = budget(base + added);
  const avoidedRunoffM3 = Math.max(0, now.runoffM3 - possible.runoffM3);
  return {
    rainfallMm: rain, landAreaM2, rainfallVolumeM3, now, possible, avoidedRunoffM3,
    runoffReductionPercent: now.runoffM3 > 0 ? avoidedRunoffM3 / now.runoffM3 * 100 : 0,
    provenance: STORM_PROVENANCE,
  };
}

export function stormSweep(cover: LandCover, scenario: Scenario, areaM2: number) {
  return STORM_DEPTHS_MM.map((depth) => compareStorm(cover, scenario, areaM2, depth));
}
