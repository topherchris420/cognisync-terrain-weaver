import type { Experiment } from "./experiment";
import { referenceAgreement, repeatStability, scoreIntegrity, syntheticSemanticAgreement } from "./experiments/classification";
import { crossModelConsistency, curveNumberBenchmark } from "./experiments/hydrology";
import { complaintAssociationDevelopment, complaintAssociationHoldout, demSourceSensitivity, resolutionSensitivity, syntheticRouting } from "./experiments/routing";
import { bioswaleHypothesis, planRobustness, uncertaintyPropagation } from "./experiments/interventions";
import { substrateDeterminism } from "./experiments/substrate";

/** Every registered experiment, in reporting order. */
export const EXPERIMENTS: Experiment[] = [
  referenceAgreement,
  repeatStability,
  scoreIntegrity,
  syntheticSemanticAgreement,
  crossModelConsistency,
  curveNumberBenchmark,
  syntheticRouting,
  resolutionSensitivity,
  demSourceSensitivity,
  complaintAssociationDevelopment,
  complaintAssociationHoldout,
  bioswaleHypothesis,
  planRobustness,
  uncertaintyPropagation,
  substrateDeterminism,
];

export function findExperiment(query: string): Experiment[] {
  const q = query.toLowerCase();
  return EXPERIMENTS.filter((e) => e.spec.id.toLowerCase() === q || e.spec.domain === q || e.spec.id.toLowerCase().includes(q));
}
