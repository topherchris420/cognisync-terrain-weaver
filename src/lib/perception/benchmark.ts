import { validateLandCover } from "../../../supabase/functions/_shared/land-cover";
import type { LandCover } from "@/lib/types";
import { COMPOSITION_KEYS, NOT_REAL_WORLD, SYNTHETIC_LABEL, landCoverToComposition, validateComposition, type CompositionKey, type ImageSource, type SemanticComposition, type SyntheticScene } from "./synthetic-scene";

/** One classifier answer for one scene. */
export interface BenchmarkPrediction {
  sceneId: string;
  /** SHA-256 of the image that was classified; must match the scene's. */
  rgbSha256: string | null;
  repeat: number;
  landCover: LandCover;
  model: string;
  classifiedAt: string;
}

/**
 * The only thing the classifier sees: the RGB image source. No ground truth,
 * no metadata, no scene name or location is ever passed.
 */
export type RgbClassifier = (rgb: ImageSource) => Promise<{ landCover: LandCover; model: string }>;

export async function runSyntheticBenchmark(
  scenes: SyntheticScene[],
  classify: RgbClassifier,
  options: { repeats?: number; now?: () => string } = {},
): Promise<BenchmarkPrediction[]> {
  const repeats = options.repeats ?? 1;
  const now = options.now ?? (() => new Date().toISOString());
  const predictions: BenchmarkPrediction[] = [];
  for (const scene of scenes) {
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const rgb: ImageSource = { kind: scene.rgb.kind, value: scene.rgb.value, sha256: scene.rgb.sha256 };
      const { landCover, model } = await classify(rgb);
      predictions.push({ sceneId: scene.id, rgbSha256: scene.rgb.sha256, repeat, landCover: validateLandCover(landCover), model, classifiedAt: now() });
    }
  }
  return predictions;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN);
const sd = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / (values.length - 1));
};
const round = (value: number, digits = 2) => {
  const f = digits === 1 ? 10 : digits === 3 ? 1000 : 100;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
};
const pervious = (c: SemanticComposition) => c.vegetation + c.bareSoil;

export interface SceneEvaluation {
  sceneId: string;
  truth: SemanticComposition;
  predicted: SemanticComposition;
  errorPP: Record<CompositionKey, number>;
  totalCompositionErrorPP: number;
  perviousErrorPP: number;
  repeatSdPP: Record<CompositionKey, number>;
  /** Largest max − min of any class across repeats, pp. */
  repeatRangePP: number;
  repeats: number;
  conditions: Record<string, string>;
}

export interface BenchmarkEvaluation {
  label: typeof SYNTHETIC_LABEL;
  caveat: typeof NOT_REAL_WORLD;
  scenes: number;
  excludedScenes: Array<{ sceneId: string; reason: string }>;
  predictions: number;
  perClassMaePP: Record<CompositionKey, number> | null;
  perClassBiasPP: Record<CompositionKey, number> | null;
  /** Mean half-L1 (total variation) distance between predicted and true composition, pp. */
  totalCompositionErrorPP: number | null;
  perviousShareMaePP: number | null;
  perviousShareBiasPP: number | null;
  /**
   * Estimated composition transfer, from → to (pp, mean over scenes): each
   * scene's under-predicted share allocated to its over-predicted classes in
   * proportion. A trend summary, NOT a pixel confusion matrix: the classifier
   * returns shares, not per-pixel labels.
   */
  estimatedTransferPP: Record<CompositionKey, Record<CompositionKey, number>> | null;
  /** Mean over scenes of the per-class SD across repeated classifications, pp. */
  repeatSdPP: number | null;
  maxRepeatRangePP: number | null;
  byCondition: Array<{ condition: string; value: string; scenes: number; totalCompositionErrorPP: number; perviousShareMaePP: number }>;
  perScene: SceneEvaluation[];
}

/**
 * Score predictions against known composition. Only nadir scenes enter the
 * metrics; oblique ones are listed as excluded. Predictions whose image hash
 * does not match the scene's are refused rather than scored.
 */
export function evaluateSyntheticBenchmark(scenes: SyntheticScene[], predictions: BenchmarkPrediction[]): BenchmarkEvaluation {
  const excludedScenes: Array<{ sceneId: string; reason: string }> = [];
  const perScene: SceneEvaluation[] = [];
  for (const scene of [...scenes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    validateComposition(scene.groundTruth);
    if (scene.metadata.camera?.view !== "nadir") {
      excludedScenes.push({ sceneId: scene.id, reason: "not a nadir view" });
      continue;
    }
    const mine = predictions.filter((p) => p.sceneId === scene.id).sort((a, b) => a.repeat - b.repeat);
    if (mine.some((p) => p.rgbSha256 !== scene.rgb.sha256)) throw new Error(`Prediction for ${scene.id} was made on a different image.`);
    if (mine.length === 0) {
      excludedScenes.push({ sceneId: scene.id, reason: "no prediction" });
      continue;
    }
    const compositions = mine.map((p) => landCoverToComposition(validateLandCover(p.landCover)));
    const predicted = Object.fromEntries(COMPOSITION_KEYS.map((k) => [k, mean(compositions.map((c) => c[k]))])) as SemanticComposition;
    const errorPP = Object.fromEntries(COMPOSITION_KEYS.map((k) => [k, predicted[k] - scene.groundTruth[k]])) as Record<CompositionKey, number>;
    perScene.push({
      sceneId: scene.id,
      truth: scene.groundTruth,
      predicted,
      errorPP,
      totalCompositionErrorPP: COMPOSITION_KEYS.reduce((s, k) => s + Math.abs(errorPP[k]), 0) / 2,
      perviousErrorPP: pervious(predicted) - pervious(scene.groundTruth),
      repeatSdPP: Object.fromEntries(COMPOSITION_KEYS.map((k) => [k, sd(compositions.map((c) => c[k]))])) as Record<CompositionKey, number>,
      repeatRangePP: Math.max(...COMPOSITION_KEYS.map((k) => Math.max(...compositions.map((c) => c[k])) - Math.min(...compositions.map((c) => c[k])))),
      repeats: mine.length,
      conditions: Object.fromEntries(
        (["lighting", "weather", "sceneClass"] as const).flatMap((k) => (scene.metadata[k] ? [[k, String(scene.metadata[k])]] : [])),
      ),
    });
  }
  const base: BenchmarkEvaluation = {
    label: SYNTHETIC_LABEL,
    caveat: NOT_REAL_WORLD,
    scenes: perScene.length,
    excludedScenes,
    predictions: predictions.length,
    perClassMaePP: null,
    perClassBiasPP: null,
    totalCompositionErrorPP: null,
    perviousShareMaePP: null,
    perviousShareBiasPP: null,
    estimatedTransferPP: null,
    repeatSdPP: null,
    maxRepeatRangePP: null,
    byCondition: [],
    perScene,
  };
  if (perScene.length === 0) return base;

  const byClass = (f: (s: SceneEvaluation, k: CompositionKey) => number) =>
    Object.fromEntries(COMPOSITION_KEYS.map((k) => [k, round(mean(perScene.map((s) => f(s, k))))])) as Record<CompositionKey, number>;
  const transfer = Object.fromEntries(COMPOSITION_KEYS.map((from) => [from, Object.fromEntries(COMPOSITION_KEYS.map((to) => [to, 0]))])) as Record<CompositionKey, Record<CompositionKey, number>>;
  for (const s of perScene) {
    const deficits = COMPOSITION_KEYS.map((k) => Math.max(0, -s.errorPP[k]));
    const surpluses = COMPOSITION_KEYS.map((k) => Math.max(0, s.errorPP[k]));
    const moved = surpluses.reduce((a, b) => a + b, 0);
    if (moved === 0) continue;
    COMPOSITION_KEYS.forEach((from, i) => COMPOSITION_KEYS.forEach((to, j) => (transfer[from][to] += (deficits[i] * surpluses[j]) / moved / perScene.length)));
  }
  for (const from of COMPOSITION_KEYS) for (const to of COMPOSITION_KEYS) transfer[from][to] = round(transfer[from][to]);

  const repeated = perScene.filter((s) => s.repeats > 1);
  const conditions = new Map<string, SceneEvaluation[]>();
  for (const s of perScene) for (const [k, v] of Object.entries(s.conditions)) conditions.set(`${k}\u0000${v}`, [...(conditions.get(`${k}\u0000${v}`) ?? []), s]);

  return {
    ...base,
    perClassMaePP: byClass((s, k) => Math.abs(s.errorPP[k])),
    perClassBiasPP: byClass((s, k) => s.errorPP[k]),
    totalCompositionErrorPP: round(mean(perScene.map((s) => s.totalCompositionErrorPP))),
    perviousShareMaePP: round(mean(perScene.map((s) => Math.abs(s.perviousErrorPP)))),
    perviousShareBiasPP: round(mean(perScene.map((s) => s.perviousErrorPP))),
    estimatedTransferPP: transfer,
    repeatSdPP: repeated.length ? round(mean(repeated.flatMap((s) => COMPOSITION_KEYS.map((k) => s.repeatSdPP[k])))) : null,
    maxRepeatRangePP: repeated.length ? round(Math.max(...repeated.map((s) => s.repeatRangePP))) : null,
    byCondition: [...conditions.entries()]
      .map(([key, group]) => {
        const [condition, value] = key.split("\u0000");
        return {
          condition,
          value,
          scenes: group.length,
          totalCompositionErrorPP: round(mean(group.map((s) => s.totalCompositionErrorPP))),
          perviousShareMaePP: round(mean(group.map((s) => Math.abs(s.perviousErrorPP)))),
        };
      })
      .sort((a, b) => (a.condition + a.value < b.condition + b.value ? -1 : 1)),
  };
}
