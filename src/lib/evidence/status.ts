import type { ScientificStatus } from "@/lib/counterfactual/types";

/**
 * The epistemic status of a number. A value keeps its status wherever it
 * travels — into a panel, a map, an export — so a beautiful rendering never
 * promotes an assumption into a measurement.
 */
export type EvidenceStatus =
  | "measured" // instrument or survey observation (elevation, gauge, footprint)
  | "reported" // human reports of an outcome (311 complaints); not a measurement
  | "inferred" // estimated from observations by a model, e.g. AI land cover
  | "modeled" // computed deterministically from inputs by this instrument's code
  | "assumed" // a coefficient or rate chosen by the authors
  | "reconstructed" // historical ecology reconstruction
  | "counterfactual" // a surface or outcome that does not exist
  | "illustrative"; // teaching fixture or fallback; stands for nothing real

export const EVIDENCE_META: Record<EvidenceStatus, { label: string; means: string }> = {
  measured: { label: "Measured", means: "Observed by an instrument or survey, with its own error." },
  reported: { label: "Reported", means: "People reported it; absence of a report is not evidence of absence." },
  inferred: { label: "Inferred", means: "Estimated from observations by a model; not itself an observation." },
  modeled: { label: "Modeled", means: "Calculated by deterministic code from the inputs shown." },
  assumed: { label: "Assumed", means: "A chosen coefficient or rate. See the assumption registry." },
  reconstructed: { label: "Reconstructed", means: "Historical reconstruction, not direct measurement." },
  counterfactual: { label: "Counterfactual", means: "Describes a surface that does not exist." },
  illustrative: { label: "Illustrative", means: "A teaching fixture or fallback; stands for nothing real." },
};

/** Maps the counterfactual engine's legacy vocabulary onto the evidence hierarchy. */
export function fromScientificStatus(status: ScientificStatus): EvidenceStatus {
  switch (status) {
    case "observed":
      return "measured";
    case "inferred":
      return "inferred";
    case "reconstructed":
      return "reconstructed";
    case "illustrative":
      return "illustrative";
    case "derived":
    case "modeled":
      return "modeled";
    case "projected":
    case "speculative":
      return "counterfactual";
  }
}

/** A value that carries its epistemic status and where it came from. */
export interface Evidenced<T> {
  value: T;
  status: EvidenceStatus;
  unit?: string;
  /** Registry id, dataset id, function name or experiment id. */
  source: string;
}

export function evidenced<T>(value: T, status: EvidenceStatus, source: string, unit?: string): Evidenced<T> {
  return unit === undefined ? { value, status, source } : { value, status, source, unit };
}

/**
 * Status of a computed value is never stronger than its weakest input:
 * a modeled runoff on inferred cover with assumed coefficients is modeled,
 * but an illustrative input keeps the whole result illustrative.
 */
export function weakestStatus(statuses: EvidenceStatus[]): EvidenceStatus {
  if (statuses.includes("illustrative")) return "illustrative";
  if (statuses.includes("counterfactual")) return "counterfactual";
  return "modeled";
}

/** How far a component has been tested against the world. */
export type ValidationLevel =
  | "unvalidated" // no comparison with independent evidence yet
  | "internally-consistent" // software tests pass; says nothing about nature
  | "benchmarked" // compared with an independent reference or reference model
  | "externally-tested" // compared with independent observations, error reported
  | "failed"; // compared, and the comparison went against the model

export const VALIDATION_META: Record<ValidationLevel, { label: string; means: string }> = {
  unvalidated: { label: "Unvalidated", means: "Not yet compared with independent evidence." },
  "internally-consistent": { label: "Internally consistent", means: "Code implements its equations; nature not consulted." },
  benchmarked: { label: "Benchmarked", means: "Compared with an independent reference dataset or reference model." },
  "externally-tested": { label: "Externally tested", means: "Compared with independent observations; error reported." },
  failed: { label: "Did not hold", means: "Compared with evidence, and the evidence went against it." },
};
