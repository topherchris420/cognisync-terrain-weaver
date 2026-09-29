import type { SimulationResponse } from "@/lib/simulation-types";

/**
 * A counterfactual is a controlled experiment: NOW and POSSIBLE must share
 * every input except the intervention. This check makes it impossible for an
 * accidental change of forcing, extent, resolution, land cover, terrain or
 * model to be reported as an intervention effect.
 */
export interface ControlledVariable {
  id: string;
  label: string;
  now: string;
  possible: string;
  identical: boolean;
}

export interface ControlledComparison {
  valid: boolean;
  /** Variables that must be identical between the two runs. */
  fixed: ControlledVariable[];
  /** The one thing allowed to differ: the intervention surface. */
  treatment: ControlledVariable;
  violations: string[];
}

type Metadata = SimulationResponse["metadata"];

const FIXED: Array<[keyof Metadata, string]> = [
  ["storm_hash", "Sealed storm identity"],
  ["rainfall_mm", "Rainfall depth (mm)"],
  ["duration_min", "Duration (min)"],
  ["extent_hash", "Study extent and grid"],
  ["cells_analyzed", "Resolution (cells)"],
  ["land_cover_hash", "Initial land-cover composition"],
  ["elevation_hash", "Elevation surface"],
  ["elevation_status", "Elevation status"],
  ["model", "Routing model version"],
];

export function controlledComparison(now: SimulationResponse, possible: SimulationResponse): ControlledComparison {
  const show = (value: unknown) => (value === undefined || value === null ? "(not recorded)" : String(value));
  const fixed = FIXED.map(([key, label]) => {
    const a = now.metadata[key];
    const b = possible.metadata[key];
    return { id: key, label, now: show(a), possible: show(b), identical: a !== undefined && a !== null && a === b };
  });
  const treatment = {
    id: "modifier_hash",
    label: "Intervention surface",
    now: show(now.metadata.modifier_hash),
    possible: show(possible.metadata.modifier_hash),
    identical: now.metadata.modifier_hash === possible.metadata.modifier_hash,
  };
  const violations = [
    ...fixed.filter((v) => !v.identical).map((v) => `${v.label} differs or is unrecorded (NOW ${v.now}, POSSIBLE ${v.possible}).`),
    ...(treatment.identical ? ["The intervention surface is identical in both runs: there is no treatment to compare."] : []),
  ];
  return { valid: violations.length === 0, fixed, treatment, violations };
}
