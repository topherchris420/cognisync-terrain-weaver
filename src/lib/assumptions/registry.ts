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
export const ASSUMPTION_REGISTRY_VERSION = "2026-09-29.2";

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
  note = "",
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
      "Revisit if the fixed runoff fraction falls outside the TR-55 curve-number envelope (soil groups A–D) at more than half of the tested storm depths (10–200 mm), or if independent event observations for this class disagree in a consistent direction.",
    basis:
      `"More than half the depths" means the coefficient misrepresents the class over most of the range the app lets users explore; fewer excursions are expected from any depth-independent coefficient. No local event runoff observations are held, so the curve-number method is the only numeric reference.${note}`,
    check: { experiment: "hydrology/H2-curve-number-benchmark", finding: `${key}ShareOfDepthsOutsideEnvelope`, comparison: ">", threshold: 0.5 },
  },
});

export const ASSUMPTIONS: Assumption[] = [
  retention("vegetation", "Vegetation", 0.8, [0.75, 0.95]),
  retention("soil", "Bare soil", 0.7, [0.6, 0.8]),
  retention("buildings", "Roofs", 0.1, [0.05, 0.25], " For roofs TR-55 gives one value (CN 98), so the envelope has zero width and any deviation counts: this is the strictest wire in the registry."),
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
    id: "classification.sensitivity_default_pp",
    label: "Default vegetation ↔ pavement sensitivity range",
    value: 7,
    unit: "percentage points of the frame",
    basis: "derived",
    source: "classification/C1-nlcd-agreement: mean absolute pervious-share error against NLCD 2021, rounded",
    sourceDate: "2026-09-29",
    geography: "16 distinct US frames, mostly NYC",
    range: null,
    limitation:
      "Was 5 pp by choice until C1 measured 6.7 pp. Disagreement with a 30 m reference, not error against truth; repeat-run spread on one frame (classification/C2) is larger still.",
    usedBy: ["src/components/analyze/EvidencePanel.tsx", "src/lib/evidence/ledger.ts"],
    tripwire: {
      condition: "Revisit whenever the benchmark-derived pervious error moves more than 1 pp away from this default (the machine check covers upward drift).",
      basis: "The default should track the measured error at the resolution users can set (whole percentage points).",
      check: { experiment: "classification/C1-nlcd-agreement", finding: "perviousMaePP", comparison: ">", threshold: 8 },
    },
  },
  {
    id: "routing.receiving_water_max_elevation",
    label: "Elevation at or below which a cell is receiving tidal water",
    value: 0,
    unit: "m above the DEM datum",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "Coastal NYC",
    range: null,
    limitation:
      "Terrarium mixes bathymetry and contains artefacts down to −14 km along NYC shorelines (routing/R3). Land genuinely below 0 m, if any exists in an extent, would be treated as water.",
    usedBy: ["src/lib/hydrology/conditioning.ts"],
    tripwire: {
      condition: "Revisit if a DEM with a verified vertical datum shows land below 0 m inside study areas, or when the app runs outside tidal coasts.",
      basis: "Qualitative: no surveyed below-sea-level land is known in the tested areas.",
    },
  },
  {
    id: "routing.hotspots_indicate_flooding",
    label: "Routed accumulation ranks indicate where surface flooding concentrates",
    value: 1,
    unit: "relied upon (1) or not (0)",
    basis: "scenario-assumption",
    source: null,
    sourceDate: null,
    geography: "NYC study areas",
    range: null,
    limitation:
      "The colored zones on the storm map are accumulation ranks. On the preregistered holdout event they located reported street flooding no better than chance, while simple low elevation did better (routing/R5).",
    usedBy: ["src/lib/hydrology/engine.ts (risk_zones, impact_points)", "src/components/FloodVolumeLayer.tsx"],
    tripwire: {
      condition: "Tripped when the preregistered holdout shows routed accumulation doing worse than the low-elevation baseline (upper 95% bound of the difference below zero).",
      basis: "Preregistered in experiments/PREREGISTRATION.md: the baseline must be beaten for the ranks to carry information beyond terrain lowness.",
      check: { experiment: "routing/R5-311-association-holdout", finding: "aucDifferenceUpper", comparison: "<", threshold: 0 },
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
