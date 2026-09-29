import type { Experiment } from "./experiment";
import { referenceAgreement, repeatStability, scoreIntegrity } from "./experiments/classification";
import { crossModelConsistency, curveNumberBenchmark } from "./experiments/hydrology";
import { complaintAssociationDevelopment, demSourceSensitivity, resolutionSensitivity, syntheticRouting } from "./experiments/routing";
import { bioswaleHypothesis, planRobustness, uncertaintyPropagation } from "./experiments/interventions";

/** Every registered experiment, in reporting order. */
export const EXPERIMENTS: Experiment[] = [
  referenceAgreement,
  repeatStability,
  scoreIntegrity,
  crossModelConsistency,
  curveNumberBenchmark,
  syntheticRouting,
  resolutionSensitivity,
  demSourceSensitivity,
  complaintAssociationDevelopment,
  bioswaleHypothesis,
  planRobustness,
  uncertaintyPropagation,
];

export function findExperiment(query: string): Experiment[] {
  const q = query.toLowerCase();
  return EXPERIMENTS.filter((e) => e.spec.id.toLowerCase() === q || e.spec.domain === q || e.spec.id.toLowerCase().includes(q));
}
