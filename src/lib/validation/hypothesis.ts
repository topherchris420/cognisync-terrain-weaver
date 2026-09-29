/**
 * An intervention is a hypothesis, not a recommendation.
 *
 * "Converting 1,500 m² of pavement to bioswale reduces modeled runoff by at
 * least 8%" can be supported or not supported *by the model*. That is support
 * within the model's assumptions, never proof of a real-world outcome; real
 * outcome evidence is a separate validation layer.
 */
export interface InterventionHypothesis {
  statement: string;
  metric: string;
  comparison: ">=" | "<=";
  threshold: number;
}

export type ModelVerdict = "supported-by-model" | "not-supported-by-model" | "inconclusive";

export const MODEL_VERDICT_LABEL: Record<ModelVerdict, string> = {
  "supported-by-model": "Supported by the model",
  "not-supported-by-model": "Not supported by the model",
  inconclusive: "Inconclusive within the tested uncertainty",
};

/**
 * Judge a hypothesis against the central result and, when available, the
 * bounded sensitivity envelope. If the envelope straddles the threshold the
 * verdict is inconclusive: the conclusion depends on an assumption we cannot
 * yet pin down.
 */
export function judgeHypothesis(
  hypothesis: InterventionHypothesis,
  central: number,
  envelope?: { min: number; max: number },
): ModelVerdict {
  const holds = (value: number) => (hypothesis.comparison === ">=" ? value >= hypothesis.threshold : value <= hypothesis.threshold);
  if (envelope && holds(envelope.min) !== holds(envelope.max)) return "inconclusive";
  return holds(central) ? "supported-by-model" : "not-supported-by-model";
}
