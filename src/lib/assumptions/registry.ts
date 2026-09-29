/**
 * Versioned assumption registry.
 *
 * Every coefficient, rate and threshold the instrument depends on, with the
 * evidence behind it — or an explicit statement that there is none. A test
 * (registry.test.ts) fails if any live constant drifts from this registry, so
 * an assumption cannot change silently, and cannot become permanent simply
 * because it was coded first: each carries a tripwire naming the evidence that
 * should force it to be revisited.
 *
 * Bump ASSUMPTION_REGISTRY_VERSION whenever a value, range or tripwire changes.
 */
export const ASSUMPTION_REGISTRY_VERSION = "2026-09-29.1";

export type AssumptionBasis =
  /** Taken from a cited published range; the chosen point inside it is ours. */
  | "published-range"
  /** Derived from other registry entries or from this repository's data. */
  | "derived"
  /** No defensible source exists yet; a scenario choice, stated as such. */
  | "scenario-assumption";

export interface Tripwire {
  /** What evidence should force reconsideration. */
  condition: string;
  /** Why this threshold, or why only a qualitative trigger is defensible. */
  basis: string;
  /**
   * Machine-checkable form, evaluated by the experiment runner against
   * experiment findings. Absent when no defensible numeric threshold exists.
   */
  check?: {
    experiment: string;
    finding: string;
    comparison: ">" | "<";
    threshold: number;
  };
}

export interface Assumption {
  id: string;
  label: string;
  value: number;
  unit: string;
  basis: AssumptionBasis;
  source: string | null;
  sourceDate: string | null;
  geography: string;
  /** Plausible range from the source, or null when none exists. */
  range: [number, number] | null;
  limitation: string;
  usedBy: string[];
  tripwire: Tripwire;
}

const RATIONAL_C = "Rational Method runoff coefficient ranges (ASCE; Chow, Maidment & Mays, Applied Hydrology), recorded in docs/absorption-calibration.md";
const NO_COST_SOURCE =
  "No source recorded. Source year, geography, inflation basis and scope (materials, labour, design) are undocumented.";

const retention = (
  key: "vegetation" | "soil" | "buildings" | "pavement",
  label: string,
  value: number,
  range: [number, number],
): Assumption => ({
  id: `retention.${key}`,
  label: `${label} retention weight (1 − C)`,
  value,
  unit: "fraction of rainfall retained",
  basis: "published-range",
  source: RATIONAL_C,
  sourceDate: "2026-07-14 (calibration record)",
  geography: "Generic urban land; no NYC soil, slope or antecedent-moisture calibration",
  range,
  limitation:
    "A single storm-independent coefficient. Real retention depends on storm depth, soil group, slope and antecedent moisture; the fixed value cannot represent saturation.",
  usedBy: ["src/lib/absorption.ts", "src/lib/paired-storm.ts", "src/lib/simulation.ts (routing, as 1 − weight)"],
  tripwire: {
    condition:
      "Revisit if independent event observations for this surface class show retention outside the cited range in a consistent direction, or if the curve-number benchmark (hydrology/H2) shows the fixed value outside its soil-group envelope across most tested storm depths.",
    basis:
      "The cited range is the only external evidence currently held; no local event runoff data exist in this repository to set a tighter numeric trigger.",
  },
});

export const ASSUMPTIONS: Assumption[] = [
  retention("vegetation", "Vegetation", 0.8, [0.75, 0.95]),
  retention("soil", "Bare soil", 0.7, [0.6, 0.8]),
  retention("buildings", "Roofs", 0.1, [0.05, 0.25]),
  retention("pavement", "Pavement", 0.12, [0.05, 0.3]),
  {
    id: "retention.water",
    label: "Open water in the land budget",
    value: 0,
    unit: "fraction of rainfall retained",
    basis: "derived",
    source: "docs/absorption-calibration.md: open water is the receiving body, not absorption capacity",
    sourceDate: "2026-07-14",
    geography: "All",
    range: null,
    limitation:
      "Water is excluded from the score denominator. In routing, rain falling on open water is carried as runoff to the receiving body rather than credited as retention.",
    usedBy: ["src/lib/absorption.ts", "src/lib/simulation.ts"],
    tripwire: {
      condition: "Revisit only if the score's purpose changes from land retention to whole-frame water accounting.",
      basis: "Structural modelling choice, not an empirical coefficient.",
    },
  },
  {
    id: "intervention.street_trees.retention",
    label: "Street trees & pocket parks: converted-surface retention",
    value: 0.8,
    unit: "fraction of rainfall retained",
    basis: "derived",
    source: "Equal to retention.vegetation",
    sourceDate: "2026-07-14",
    geography: "Generic",
    range: [0.75, 0.95],
    limitation: "Treats a planted pit as mature vegetated ground immediately; establishment time, canopy interception and soil volume are not modelled.",
    usedBy: ["src/lib/scenario.ts", "src/components/MapEditor.tsx (routing modifier)"],
    tripwire: {
      condition: "Revisit when monitored street-tree or depaving performance data for NYC become available.",
      basis: "No local performance evidence is held.",
    },
  },
  {
    id: "intervention.bioswales.retention",
    label: "Bioswales & rain gardens: converted-surface retention",
    value: 0.9,
    unit: "fraction of rainfall retained",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Unspecified",
    range: null,
    limitation:
      "No source recorded. Real bioswales capture run-on from a contributing drainage area and fail by overflow once storage is full; this model credits only rain falling on the swale footprint and never saturates.",
    usedBy: ["src/lib/scenario.ts", "src/components/MapEditor.tsx (routing modifier)"],
    tripwire: {
      condition:
        "Revisit before any claim that relies on bioswale performance being better than trees. The intervention robustness experiment (interventions/I2) reports whether conclusions survive a 50% lower effectiveness.",
      basis: "Scenario assumption with no evidence; any monitored bioswale data would supersede it.",
    },
  },
  {
    id: "intervention.permeable_pavement.retention",
    label: "Permeable pavement: converted-surface retention",
    value: 0.75,
    unit: "fraction of rainfall retained",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Unspecified",
    range: null,
    limitation: "No source recorded. Clogging and maintenance-dependent decline are not modelled.",
    usedBy: ["src/lib/scenario.ts"],
    tripwire: { condition: "Revisit when a sourced value exists.", basis: "Scenario assumption with no evidence." },
  },
  {
    id: "intervention.green_roofs.retention",
    label: "Green roofs: converted-surface retention",
    value: 0.6,
    unit: "fraction of rainfall retained",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Unspecified",
    range: null,
    limitation: "No source recorded. Event retention of green roofs depends strongly on storm depth and substrate depth.",
    usedBy: ["src/lib/scenario.ts"],
    tripwire: { condition: "Revisit when a sourced value exists.", basis: "Scenario assumption with no evidence." },
  },
  ...(
    [
      ["street_trees", "Street trees & pocket parks", 45],
      ["bioswales", "Bioswales & rain gardens", 65],
      ["permeable_pavement", "Permeable pavement", 150],
      ["green_roofs", "Green roofs", 180],
    ] as const
  ).map(
    ([key, label, value]): Assumption => ({
      id: `cost.${key}`,
      label: `${label}: installed unit cost`,
      value,
      unit: "USD per m² installed",
      basis: "scenario-assumption",
      source: null,
      sourceDate: null,
      geography: "Unspecified",
      range: null,
      limitation: `${NO_COST_SOURCE} Maintenance, replacement, permitting and land acquisition are excluded.`,
      usedBy: ["src/lib/scenario.ts", "src/lib/catalyst.ts"],
      tripwire: {
        condition:
          "Revisit when any sourced local unit cost is available. The intervention robustness experiment (interventions/I2) reports whether least-cost rankings survive a +20% cost change.",
        basis: "Scenario assumption with no evidence; precision beyond an order of magnitude is not claimed.",
      },
    }),
  ),
  {
    id: "economics.annual_rainfall",
    label: "Annual rainfall for benefit estimates",
    value: 1200,
    unit: "mm per year",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Applied to every site, anywhere",
    range: null,
    limitation: "A single default for all locations; not a local climate normal.",
    usedBy: ["src/lib/scenario.ts (DEFAULT_ASSUMPTIONS)"],
    tripwire: { condition: "Replace with a sourced local normal before comparing annual benefits between cities.", basis: "Scenario default." },
  },
  {
    id: "economics.benefit_per_m3",
    label: "Monetised benefit of retained stormwater",
    value: 2.5,
    unit: "USD per m³ retained",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Unspecified",
    range: null,
    limitation: "Not an audited avoided-cost figure; payback periods derived from it are illustrative.",
    usedBy: ["src/lib/scenario.ts (DEFAULT_ASSUMPTIONS)"],
    tripwire: { condition: "Do not present payback as a finding until this is sourced.", basis: "Scenario default." },
  },
  {
    id: "score.band.moderate",
    label: "Score band threshold: moderate",
    value: 35,
    unit: "score points",
    basis: "derived",
    source: "Distribution of 18 calibration scans (docs/absorption-calibration.md)",
    sourceDate: "2026-07-14",
    geography: "18 global sites",
    range: null,
    limitation: "Bands describe the score distribution, not observed flood frequency. Not a hazard category.",
    usedBy: ["src/lib/absorption.ts"],
    tripwire: {
      condition: "Retire the flood-risk wording of bands unless bands are shown to separate observed flooding outcomes.",
      basis: "Qualitative: no outcome data support any numeric band yet.",
    },
  },
  {
    id: "score.band.low",
    label: "Score band threshold: low",
    value: 55,
    unit: "score points",
    basis: "derived",
    source: "Distribution of 18 calibration scans (docs/absorption-calibration.md)",
    sourceDate: "2026-07-14",
    geography: "18 global sites",
    range: null,
    limitation: "Bands describe the score distribution, not observed flood frequency. Not a hazard category.",
    usedBy: ["src/lib/absorption.ts"],
    tripwire: {
      condition: "Retire the flood-risk wording of bands unless bands are shown to separate observed flooding outcomes.",
      basis: "Qualitative: no outcome data support any numeric band yet.",
    },
  },
  {
    id: "hydrograph.time_to_peak",
    label: "Hydrograph time to peak",
    value: 0.4,
    unit: "fraction of storm duration",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "All",
    range: null,
    limitation: "A prescribed triangular shape scaled to routed volume; not calibrated discharge.",
    usedBy: ["src/lib/hydrology/hydrograph.ts"],
    tripwire: { condition: "Never report peak discharge as a finding until compared with gauged discharge.", basis: "No discharge data held." },
  },
  {
    id: "hydrograph.base_time",
    label: "Hydrograph base time",
    value: 1.67,
    unit: "multiple of storm duration",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "All",
    range: null,
    limitation: "A prescribed triangular shape scaled to routed volume; not calibrated discharge.",
    usedBy: ["src/lib/hydrology/hydrograph.ts"],
    tripwire: { condition: "Never report peak discharge as a finding until compared with gauged discharge.", basis: "No discharge data held." },
  },
];

export function assumption(id: string): Assumption {
  const found = ASSUMPTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown assumption ${id}.`);
  return found;
}
