import { ABSORPTION_WEIGHTS, classifyFloodRisk } from "./absorption";
import type { FloodRisk, LandCover, LandCoverKey } from "./types";

/**
 * Scenario Studio — what-if modeling for green-infrastructure interventions.
 *
 * Each intervention converts a fraction of one land-cover class into a
 * surface with a different effective absorption weight. Because the Urban
 * Absorption Score is a weighted sum of cover shares, an intervention's
 * effect is exactly:
 *
 *   Δscore = share(source) × fraction × (targetWeight − sourceWeight) × 100
 *
 * Costs are planning-level unit costs (USD/m² installed) drawn from published
 * green-infrastructure ranges (EPA, city stormwater programs). They are
 * deliberately transparent and easy to recalibrate — like the absorption
 * weights themselves.
 */

export type InterventionKey =
  | "street_trees"
  | "bioswales"
  | "permeable_pavement"
  | "green_roofs";

export interface InterventionDef {
  key: InterventionKey;
  label: string;
  /** Land-cover class the intervention converts (land only — never water). */
  source: Exclude<LandCoverKey, "water">;
  /** Effective absorption weight of the converted surface. */
  targetWeight: number;
  /** Planning-level installed cost, USD per m². */
  unitCostUSD: number;
  description: string;
}

export const INTERVENTIONS: Record<InterventionKey, InterventionDef> = {
  street_trees: {
    key: "street_trees",
    label: "Street trees & pocket parks",
    source: "pavement",
    targetWeight: ABSORPTION_WEIGHTS.vegetation,
    unitCostUSD: 45,
    description: "Depave and plant — the cheapest absorption per dollar.",
  },
  bioswales: {
    key: "bioswales",
    label: "Bioswales & rain gardens",
    source: "pavement",
    targetWeight: 0.9,
    unitCostUSD: 65,
    description: "Vegetated channels that intercept and infiltrate runoff.",
  },
  permeable_pavement: {
    key: "permeable_pavement",
    label: "Permeable pavement",
    source: "pavement",
    targetWeight: 0.75,
    unitCostUSD: 150,
    description: "Keeps the hardscape usable while letting rain through.",
  },
  green_roofs: {
    key: "green_roofs",
    label: "Green roofs",
    source: "buildings",
    targetWeight: 0.6,
    unitCostUSD: 180,
    description: "Retrofit rooftops to retain rainfall where it lands.",
  },
};

/**
 * One hue per intervention, shared by the map editor and the studio, so a
 * drawn shape and the tool that made it read as the same thing.
 */
export const INTERVENTION_COLORS: Record<InterventionKey, string> = {
  street_trees: "#86d67a",
  bioswales: "#4cc9a4",
  permeable_pavement: "#e3c98f",
  green_roofs: "#c3e86a",
};

export const INTERVENTION_ORDER: InterventionKey[] = [
  "street_trees",
  "bioswales",
  "permeable_pavement",
  "green_roofs",
];

/** Fraction (0–1) of each intervention's source class that gets converted. */
export type Scenario = Record<InterventionKey, number>;

export const EMPTY_SCENARIO: Scenario = {
  street_trees: 0,
  bioswales: 0,
  permeable_pavement: 0,
  green_roofs: 0,
};

export interface ScenarioAssumptions {
  /** Mean annual rainfall over the site, in millimetres. */
  annualRainfallMm: number;
  /**
   * Monetized annual benefit per m³ of stormwater retained (avoided flood
   * damage, deferred gray infrastructure, CSO fee reduction).
   */
  benefitPerM3USD: number;
}

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  annualRainfallMm: 1200,
  benefitPerM3USD: 2.5,
};

/**
 * Clamp every fraction to [0, 1] and, where several interventions draw from
 * the same source class, scale them down proportionally so no class is more
 * than 100% converted.
 */
export function normalizeScenario(scenario: Scenario): Scenario {
  const clamped = { ...EMPTY_SCENARIO };
  for (const key of INTERVENTION_ORDER) {
    const f = scenario[key];
    clamped[key] = Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
  }

  const totalBySource = new Map<LandCoverKey, number>();
  for (const key of INTERVENTION_ORDER) {
    const src = INTERVENTIONS[key].source;
    totalBySource.set(src, (totalBySource.get(src) ?? 0) + clamped[key]);
  }
  for (const key of INTERVENTION_ORDER) {
    const total = totalBySource.get(INTERVENTIONS[key].source) ?? 0;
    if (total > 1) clamped[key] /= total;
  }
  return clamped;
}

/** Share (0–1) of the tile occupied by each land-cover class. */
/** The classes that carry absorption. Water is excluded from the model -- it is
 *  the body that receives runoff, not capacity. See lib/absorption.ts. */
const ABSORBING = ["vegetation", "soil", "buildings", "pavement"] as const;
type AbsorbingKey = (typeof ABSORBING)[number];

/**
 * Share of the LAND (not the tile) held by each absorbing class.
 *
 * The denominator excludes open water, matching computeAbsorptionScore. An
 * intervention converts land, and its effect must be measured against the land
 * it can actually act on -- depaving 20% of a waterfront site's pavement is a
 * bigger intervention than depaving 20% of an inland site's, if half the
 * waterfront frame is harbour.
 */
function shares(cover: LandCover): Record<AbsorbingKey, number> {
  const land = ABSORBING.reduce((a, k) => a + (Number(cover[k]) || 0), 0) || 1;
  return {
    pavement: (cover.pavement || 0) / land,
    buildings: (cover.buildings || 0) / land,
    vegetation: (cover.vegetation || 0) / land,
    soil: (cover.soil || 0) / land,
  };
}

/** Physical footprint shares, including open water in the denominator.
 * Scores use land-normalized shares; costs and water volumes use these shares.
 */
export function siteCoverShares(cover: LandCover): Record<LandCoverKey, number> {
  const keys = [...ABSORBING, "water"] as const;
  const values = keys.map((key) => {
    const value = Number(cover[key]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key, index) => [key, total > 0 ? values[index] / total : 0])) as Record<LandCoverKey, number>;
}

/** Weighted absorption (0–1) of the unmodified land. */
function baseRaw(cover: LandCover): number {
  const s = shares(cover);
  return ABSORBING.reduce((sum, key) => sum + s[key] * ABSORPTION_WEIGHTS[key], 0);
}

/** Projected Urban Absorption Score (0–100) after applying a scenario. */
export function projectScore(cover: LandCover, scenario: Scenario): number {
  const s = shares(cover);
  const normalized = normalizeScenario(scenario);
  let raw = baseRaw(cover);
  for (const key of INTERVENTION_ORDER) {
    const def = INTERVENTIONS[key];
    raw +=
      s[def.source] *
      normalized[key] *
      (def.targetWeight - ABSORPTION_WEIGHTS[def.source]);
  }
  const score = Math.min(100, Math.max(0, raw * 100));
  return Math.round(score * 10) / 10;
}

export interface ScenarioImpact {
  baseScore: number;
  projectedScore: number;
  scoreDelta: number;
  baseRisk: FloodRisk;
  projectedRisk: FloodRisk;
  /** m² converted per intervention (0 when site area is unknown). */
  convertedAreaM2: Record<InterventionKey, number>;
  totalConvertedAreaM2: number;
  /** Additional stormwater retained per year, m³. */
  addedRetentionM3: number;
  /** Total installed capital cost, USD. */
  capexUSD: number;
  /** Monetized annual benefit, USD/year. */
  annualBenefitUSD: number;
  /** Simple payback, years — null when capex or benefit is zero. */
  paybackYears: number | null;
}

/**
 * Full planning-level assessment of a scenario over a site of `areaM2`.
 * Pass `areaM2 = 0` when the site footprint is unknown; score projection
 * still works, financial metrics come back as zeros.
 */
export function assessScenario(
  cover: LandCover,
  scenario: Scenario,
  areaM2: number,
  assumptions: ScenarioAssumptions = DEFAULT_ASSUMPTIONS
): ScenarioImpact {
  const s = siteCoverShares(cover);
  const normalized = normalizeScenario(scenario);
  const area = Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 : 0;

  const baseScore = Math.round(baseRaw(cover) * 100 * 10) / 10;
  const projectedScore = projectScore(cover, scenario);
  const scoreDelta = Math.round((projectedScore - baseScore) * 10) / 10;

  const convertedAreaM2 = { ...EMPTY_SCENARIO } as Record<
    InterventionKey,
    number
  >;
  let capexUSD = 0;
  let addedRetentionAreaM2 = 0;
  for (const key of INTERVENTION_ORDER) {
    const def = INTERVENTIONS[key];
    const converted = area * s[def.source] * normalized[key];
    convertedAreaM2[key] = converted;
    capexUSD += converted * def.unitCostUSD;
    addedRetentionAreaM2 += converted * (def.targetWeight - ABSORPTION_WEIGHTS[def.source]);
  }
  const totalConvertedAreaM2 = Object.values(convertedAreaM2).reduce(
    (a, b) => a + b,
    0
  );

  // Keep the physical calculation independent of rounded display scores.
  // One millimetre over one square metre is one litre.
  const addedRetentionM3 =
    (addedRetentionAreaM2 * assumptions.annualRainfallMm) / 1000;
  const annualBenefitUSD = addedRetentionM3 * assumptions.benefitPerM3USD;
  const paybackYears =
    capexUSD > 0 && annualBenefitUSD > 0 ? capexUSD / annualBenefitUSD : null;

  return {
    baseScore,
    projectedScore,
    scoreDelta,
    baseRisk: classifyFloodRisk(baseScore),
    projectedRisk: classifyFloodRisk(projectedScore),
    convertedAreaM2,
    totalConvertedAreaM2,
    addedRetentionM3,
    capexUSD,
    annualBenefitUSD,
    paybackYears,
  };
}

/** A configured scenario bundled with its assessment, ready for reporting. */
export interface ScenarioExport {
  scenario: Scenario;
  impact: ScenarioImpact;
  assumptions: ScenarioAssumptions;
}

export function hasActiveInterventions(scenario: Scenario): boolean {
  return INTERVENTION_ORDER.some((key) => scenario[key] > 0);
}

/** "$1.2M", "$430K", "$95" — compact currency for dashboards and reports. */
export function formatCompactUSD(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

/** "475,000 m³" style formatting with sensible rounding. */
export function formatVolumeM3(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value)} m³`;
}
