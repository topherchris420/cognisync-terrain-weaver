import { computeAbsorptionScore } from "@/lib/absorption";
import { bboxAreaKm2 } from "@/lib/geo";
import { compareStorm } from "@/lib/paired-storm";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import type { Experiment, ResultTable } from "../experiment";
import { aggregateCover, COVER_KEYS, feedExtent, frameKey, isClassifierOutput, type FeedRow } from "../feed";
import { mean, range, round, sd, shareOnMultiple, bias, mae } from "../metrics";
import { nlcdReference, type NlcdGrid } from "../nlcd";
import { evaluateSyntheticBenchmark, type BenchmarkPrediction } from "@/lib/perception/benchmark";
import { COMPOSITION_KEYS, NOT_REAL_WORLD, SYNTHETIC_LABEL, type SyntheticScene } from "@/lib/perception/synthetic-scene";
import { assumption } from "@/lib/assumptions/registry";

const FEED = "scan-feed.json";
const NLCD = "nlcd-2021.json";

/* ----------------------------------------------------- C2 repeat stability */

export const repeatStability: Experiment = {
  spec: {
    id: "classification/C2-repeat-stability",
    domain: "classification",
    title: "Classifier stability on an identical frame",
    question: "When the same bounding box is classified repeatedly, how much do the five class shares, the score and the 50 mm runoff vary?",
    hypothesis: null,
    tier: "repeated-measurement",
    inputs: [FEED],
    conditions: { minimumRepeats: 3, frameIdentityToleranceDeg: 1e-6, rainfallMm: 50 },
    split: "None: descriptive. The repeats are the whole sample.",
    metrics: ["per-class mean, SD, min, max (pp)", "score SD and range", "50 mm bulk runoff range (m³)", "share of class values that are multiples of 5"],
    limitations: [
      "Imagery bytes, imagery provider (Esri or the Sentinel-2 fallback) and classifier model version were not stored, so the repeats may not share identical inputs.",
      "One frame dominates the sample; stability may differ elsewhere.",
      "Stability is not accuracy: a classifier can be consistently wrong.",
    ],
  },
  run(load) {
    const rows = load<FeedRow[]>(FEED).data.filter(isClassifierOutput);
    const groups = new Map<string, FeedRow[]>();
    for (const row of rows) {
      const extent = feedExtent(row);
      if (!extent) continue;
      const key = frameKey(extent);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const repeated = [...groups.values()].filter((g) => g.length >= 3).sort((a, b) => b.length - a.length);
    if (repeated.length === 0) throw new Error("No repeated frame in the feed fixture.");
    const frame = repeated[0];
    const extent = feedExtent(frame[0])!;
    const areaM2 = bboxAreaKm2([[extent.west, extent.south], [extent.east, extent.north]]) * 1e6;
    const classRows = COVER_KEYS.map((key) => {
      const values = frame.map((r) => r.land_cover[key]);
      const r = range(values);
      return [key, round(mean(values), 1), round(sd(values), 1), r.min, r.max, round(r.span, 1)] as Array<string | number>;
    });
    const scores = frame.map((r) => computeAbsorptionScore(r.land_cover));
    const runoff = frame.map((r) => compareStorm(r.land_cover, EMPTY_SCENARIO, areaM2, 50).now.runoffM3);
    const pervious = frame.map((r) => aggregateCover(r.land_cover).pervious);
    const water = frame.map((r) => r.land_cover.water);
    const distinct = new Set(frame.map((r) => COVER_KEYS.map((k) => r.land_cover[k]).join("/"))).size;
    const modal = (() => {
      const counts = new Map<string, number>();
      for (const r of frame) {
        const k = COVER_KEYS.map((key) => r.land_cover[key]).join("/");
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      return Math.max(...counts.values());
    })();
    const allValues = rows.flatMap((r) => COVER_KEYS.map((k) => r.land_cover[k]));
    const dates = frame.map((r) => r.created_at.slice(0, 10)).sort();
    const table: ResultTable = {
      title: `Five-class shares across ${frame.length} classifications of one frame (percentage points)`,
      columns: ["class", "mean", "SD", "min", "max", "range"],
      rows: classRows,
    };
    const scoreRange = range(scores);
    const runoffRange = range(runoff);
    return {
      verdict: {
        status: "descriptive",
        statement: `The same frame received ${distinct} distinct compositions in ${frame.length} classifications. Water ranged ${range(water).min}–${range(water).max} pp and the score ${scoreRange.min}–${scoreRange.max}. Run-to-run variation is of the same order as the ±5 pp sensitivity default, and larger for water.`,
      },
      findings: {
        repeats: frame.length,
        distinctCompositions: distinct,
        modalShare: round(modal / frame.length, 3),
        waterSdPP: round(sd(water), 2),
        waterRangePP: round(range(water).span, 1),
        perviousSdPP: round(sd(pervious), 2),
        perviousRangePP: round(range(pervious).span, 1),
        scoreSd: round(sd(scores), 2),
        scoreMin: scoreRange.min,
        scoreMax: scoreRange.max,
        runoff50mmMinM3: Math.round(runoffRange.min),
        runoff50mmMaxM3: Math.round(runoffRange.max),
        runoffRelativeSpan: round(runoffRange.span / mean(runoff), 3),
        feedShareMultipleOf5: round(shareOnMultiple(allValues, 5), 3),
        feedValues: allValues.length,
      },
      observations: [
        `Frame ${frameKey(extent)} (${round(areaM2 / 1e6, 2)} km² of Lower Manhattan framed across the Hudson and East River), classified ${frame.length} times between ${dates[0]} and ${dates[dates.length - 1]}.`,
        `The most common composition occurred in ${modal} of ${frame.length} runs.`,
        `50 mm bulk runoff for this frame ranged from ${Math.round(runoffRange.min).toLocaleString("en-US")} to ${Math.round(runoffRange.max).toLocaleString("en-US")} m³ on classification alone (${round((runoffRange.span / mean(runoff)) * 100, 0)}% of the mean). Water is the largest source of spread because it changes the land area the budget applies to.`,
        `${round(shareOnMultiple(allValues, 5) * 100, 0)}% of all ${allValues.length} class values in the feed are multiples of 5 pp, confirming the rounded-output concern in the calibration record: the classifier's effective resolution is about 5 pp.`,
        `Stored centre coordinates for this frame (${frame[0].center_lat}, ${frame[0].center_lng}) lie in Midtown, outside the stored bounding box; the box, not the centre, is what was classified.`,
      ],
      tables: [
        table,
        {
          title: "Derived quantities per repeat",
          columns: ["created (UTC date)", "score", "pervious %", "water %", "50 mm runoff m³"],
          rows: frame.map((r, i) => [r.created_at.slice(0, 16), scores[i], round(pervious[i], 1), water[i], Math.round(runoff[i])]),
        },
      ],
    };
  },
};

/* --------------------------------------------------------- C3 score audit */

export const scoreIntegrity: Experiment = {
  spec: {
    id: "classification/C3-stored-score-integrity",
    domain: "classification",
    title: "Stored scores versus deterministic recomputation",
    question: "Does every stored score equal what the current deterministic scorer computes from the stored land cover?",
    hypothesis: "Every stored score equals computeAbsorptionScore(stored land cover) within 0.05 points.",
    tier: "internal-consistency",
    inputs: [FEED],
    conditions: { tolerancePoints: 0.05 },
    split: "None: an audit of every row.",
    metrics: ["rows whose stored score differs", "largest absolute difference", "rows whose score band would change"],
    limitations: ["Checks storage against code, not either against nature."],
  },
  run(load) {
    const rows = load<FeedRow[]>(FEED).data;
    const audited = rows.map((r) => ({ r, recomputed: computeAbsorptionScore(r.land_cover) }));
    const bad = audited.filter(({ r, recomputed }) => Math.abs(recomputed - r.absorption_score) > 0.05);
    const band = (s: number) => (s >= 55 ? "low" : s >= 35 ? "moderate" : "high");
    const bandChanges = bad.filter(({ r, recomputed }) => band(r.absorption_score) !== band(recomputed));
    const maxDiff = Math.max(0, ...bad.map(({ r, recomputed }) => Math.abs(recomputed - r.absorption_score)));
    return {
      verdict: bad.length === 0
        ? { status: "supported", statement: "Every stored score matches the current scorer." }
        : {
            status: "not-supported",
            statement: `${bad.length} of ${rows.length} stored scores disagree with the current scorer by up to ${round(maxDiff, 1)} points; ${bandChanges.length} would change band. Stored scores cannot be trusted as current model output.`,
          },
      findings: {
        rows: rows.length,
        mismatched: bad.length,
        maxAbsDifference: round(maxDiff, 1),
        bandChanges: bandChanges.length,
        mismatchedMeanSigned: bad.length ? round(mean(bad.map(({ r, recomputed }) => r.absorption_score - recomputed)), 2) : 0,
      },
      observations: [
        "All mismatched rows predate or coincide with the 2026-07-14 recalibration; the backfill migration in supabase/migrations evidently did not reach them in the live database.",
        "The calibration record reports recomputed scores (e.g. Bois de Boulogne 74.7), while the live feed still serves the stored ones (89.7). A reader comparing the two would see different numbers for the same scan.",
        "Consequence for the product: displays and exports must derive the score from land cover with current code rather than trusting the stored column.",
      ],
      tables: [
        {
          title: "Mismatched rows",
          columns: ["created", "label", "stored", "recomputed", "difference"],
          rows: bad.map(({ r, recomputed }) => [r.created_at.slice(0, 10), r.location_label ?? "(untitled)", r.absorption_score, recomputed, round(r.absorption_score - recomputed, 1)]),
        },
      ],
    };
  },
};

/* ------------------------------------------ C1 agreement with NLCD 2021 */

/** Score interval implied by a three-class reference, using the registered weight spread within each aggregate. */
export function referenceScoreInterval(impervious: number, pervious: number): [number, number] {
  const land = impervious + pervious;
  if (land <= 0) return [0, 0];
  const low = (impervious * 0.1 + pervious * 0.7) / land;
  const high = (impervious * 0.12 + pervious * 0.8) / land;
  return [round(low * 100, 1), round(high * 100, 1)];
}

export const referenceAgreement: Experiment = {
  spec: {
    id: "classification/C1-nlcd-agreement",
    domain: "classification",
    title: "Classifier agreement with NLCD 2021",
    question: "How far are stored classifier shares of water, impervious and pervious land from an independent 30 m national land-cover reference over the same frame?",
    hypothesis: null,
    tier: "reference-dataset",
    inputs: [FEED, NLCD],
    conditions: { reference: "NLCD 2021 land cover + percent impervious", cellCentreInFrame: true },
    split: "None: too few distinct frames for a calibration/holdout split. Descriptive only; nothing was tuned.",
    metrics: ["signed error (bias) per aggregate class (pp)", "mean absolute error per aggregate class (pp)", "whether the classified score lies inside the reference score interval"],
    limitations: [
      "NLCD is a model-derived product with its own error, especially for fine urban pervious cover; this measures disagreement with a reference, not error against truth.",
      "Epochs differ: NLCD 2021 versus scans in 2026.",
      "Buildings and pavement are not separable in NLCD, so building/pavement confusion cannot be measured here.",
      "Repeated classifications of one frame are averaged to one row per distinct frame so a single frame cannot dominate.",
      "Rows labelled `probe` are excluded as manual test inserts (PREREGISTRATION.md, Addendum 1).",
    ],
  },
  run(load) {
    const rows = load<FeedRow[]>(FEED).data.filter(isClassifierOutput);
    const nlcd = load<Record<string, NlcdGrid>>(NLCD).data;
    const byFrame = new Map<string, { rows: FeedRow[]; grid: NlcdGrid }>();
    for (const [id, grid] of Object.entries(nlcd)) {
      if (!id.startsWith("frame-")) continue;
      const key = frameKey(grid.bbox);
      const matched = rows.filter((r) => {
        const e = feedExtent(r);
        return e && frameKey(e) === key;
      });
      if (matched.length) byFrame.set(key, { rows: matched, grid });
    }
    const results = [...byFrame.values()].map(({ rows: frameRows, grid }) => {
      const ref = nlcdReference(grid);
      const agg = frameRows.map((r) => aggregateCover(r.land_cover));
      const classified = {
        water: mean(agg.map((a) => a.water)),
        impervious: mean(agg.map((a) => a.impervious)),
        pervious: mean(agg.map((a) => a.pervious)),
      };
      const score = mean(frameRows.map((r) => computeAbsorptionScore(r.land_cover)));
      const interval = referenceScoreInterval(ref.impervious, ref.pervious);
      return { label: frameRows[0].location_label ?? `(untitled ${frameRows[0].center_lat.toFixed(3)}, ${frameRows[0].center_lng.toFixed(3)})`, n: frameRows.length, ref, classified, score, interval };
    });
    const err = (k: "water" | "impervious" | "pervious") => ({
      bias: bias(results.map((r) => r.classified[k]), results.map((r) => r.ref[k])),
      mae: mae(results.map((r) => r.classified[k]), results.map((r) => r.ref[k])),
    });
    const water = err("water");
    const impervious = err("impervious");
    const pervious = err("pervious");
    const inside = results.filter((r) => r.score >= r.interval[0] && r.score <= r.interval[1]).length;
    const scoreBias = mean(results.map((r) => r.score - (r.interval[0] + r.interval[1]) / 2));
    const worst = [...results].sort((a, b) => Math.abs(b.classified.pervious - b.ref.pervious) - Math.abs(a.classified.pervious - a.ref.pervious))[0];
    return {
      verdict: {
        status: "descriptive",
        statement: `Across ${results.length} distinct US frames, the classifier's pervious share differs from NLCD by ${round(pervious.mae, 1)} pp on average (bias ${round(pervious.bias, 1)} pp) and its impervious share by ${round(impervious.mae, 1)} pp (bias ${round(impervious.bias, 1)} pp). ${inside} of ${results.length} classified scores fall inside the reference score interval.`,
      },
      findings: {
        frames: results.length,
        classifications: results.reduce((s, r) => s + r.n, 0),
        perviousBiasPP: round(pervious.bias, 2),
        perviousMaePP: round(pervious.mae, 2),
        imperviousBiasPP: round(impervious.bias, 2),
        imperviousMaePP: round(impervious.mae, 2),
        waterBiasPP: round(water.bias, 2),
        waterMaePP: round(water.mae, 2),
        scoresInsideReferenceInterval: inside,
        scoreBiasVsReferenceMidpoint: round(scoreBias, 2),
        largestPerviousResidualPP: round(worst.classified.pervious - worst.ref.pervious, 1),
      },
      observations: [
        `Largest pervious residual: ${worst.label}, classified ${round(worst.classified.pervious, 1)}% versus NLCD ${round(worst.ref.pervious, 1)}%.`,
        pervious.bias > 0
          ? "Systematic pattern: the classifier reports more pervious land (vegetation + soil) than NLCD, which would make scores and retention look better than the reference implies."
          : "Systematic pattern: the classifier reports less pervious land than NLCD, which would make scores and retention look worse than the reference implies.",
        `Water: classifier bias ${round(water.bias, 1)} pp. Impervious: bias ${round(impervious.bias, 1)} pp. A negative impervious bias means the classifier reports less building-plus-pavement than NLCD.`,
        `Classified scores sit on average ${round(scoreBias, 1)} points ${scoreBias >= 0 ? "above" : "below"} the midpoint of the reference score interval.`,
        "NLCD imperviousness is itself modelled from 30 m Landsat imagery; residuals of a few points may lie within the reference's own error.",
      ],
      tables: [
        {
          title: "Per frame: classified mean vs NLCD reference (% of frame)",
          columns: ["frame", "runs", "water cls", "water ref", "imperv cls", "imperv ref", "perv cls", "perv ref", "score", "ref score interval"],
          rows: results.map((r) => [
            r.label, r.n,
            round(r.classified.water, 1), round(r.ref.water, 1),
            round(r.classified.impervious, 1), round(r.ref.impervious, 1),
            round(r.classified.pervious, 1), round(r.ref.pervious, 1),
            round(r.score, 1), `${r.interval[0]}–${r.interval[1]}`,
          ]),
        },
      ],
    };
  },
};

/* ------------------------- C4 synthetic semantic agreement (diagnostic) */

/**
 * Registered as C4 because classification/C3 is the stored-score audit.
 * SYNTHETIC DIAGNOSTIC BENCHMARK: agreement with known composition in
 * rendered scenes. Never real-world classifier accuracy.
 */
const SCENES = "synthetic/scenes.json";
const PREDICTIONS = "synthetic/predictions.json";

export const syntheticSemanticAgreement: Experiment = {
  spec: {
    id: "classification/C4-synthetic-semantic-agreement",
    domain: "classification",
    title: "Synthetic diagnostic benchmark: does the classifier recover known composition?",
    question: "When RGB scenes have known semantic composition, how closely does the AI classifier recover vegetation, pavement, buildings, bare soil and water?",
    hypothesis: null,
    tier: "synthetic-diagnostic",
    inputs: [SCENES, PREDICTIONS],
    conditions: {
      label: SYNTHETIC_LABEL,
      view: "nadir scenes only",
      classifierInput: "RGB image only (no location, name or metadata)",
      tripwireThresholdPP: assumption("classification.synthetic_recovery_pp").value,
      tripwireThresholdSource: "classification/C1-nlcd-agreement perviousMaePP (measured on real frames), not chosen",
    },
    split: "None yet. The tripwire threshold is derived from measured real-world disagreement (C1), never from synthetic results. Any synthetic-specific threshold must be added to PREREGISTRATION before predictions are read.",
    metrics: [
      "mean absolute error by class (pp)",
      "total composition error: mean half-L1 distance (pp)",
      "pervious-share (vegetation + bare soil) mean absolute error and bias (pp)",
      "estimated composition transfer between classes (trend, not a confusion matrix)",
      "repeated-inference spread (mean per-class SD; largest range)",
      "error by scene condition (lighting, weather, scene class)",
    ],
    limitations: [
      NOT_REAL_WORLD,
      "Rendered scenes differ from satellite imagery in texture, lighting, shadow, atmosphere and sensor; only nadir renders are scored because the classifier is built for overhead imagery.",
      "Ground truth is the share of mapped pixels: sky, vehicles, people, signals and signage are excluded and their share reported; mapping terrain, park footpaths and bridge decks is a documented judgement whose share is reported.",
      "The classifier returns class shares, not pixel labels, so the transfer table is an estimated trend, not a confusion matrix.",
      "BoundlessNYC scenes with MetaHuman-derived pedestrians are refused for licence reasons (no testing of AI on them), which may bias scene selection.",
    ],
  },
  run(load) {
    const scenes = load<{ scenes: SyntheticScene[] }>(SCENES).data.scenes;
    const predictions = load<{ predictions: BenchmarkPrediction[] }>(PREDICTIONS).data.predictions;
    const result = evaluateSyntheticBenchmark(scenes, predictions);
    const mae = (key: (typeof COMPOSITION_KEYS)[number]) => result.perClassMaePP?.[key] ?? null;
    const findings = {
      frozenScenes: scenes.length,
      scoredScenes: result.scenes,
      excludedScenes: result.excludedScenes.length,
      predictions: result.predictions,
      totalCompositionErrorPP: result.totalCompositionErrorPP,
      perviousShareMaePP: result.perviousShareMaePP,
      perviousShareBiasPP: result.perviousShareBiasPP,
      vegetationMaePP: mae("vegetation"),
      pavementMaePP: mae("pavement"),
      buildingsMaePP: mae("buildings"),
      bareSoilMaePP: mae("bareSoil"),
      waterMaePP: mae("water"),
      repeatSdPP: result.repeatSdPP,
      maxRepeatRangePP: result.maxRepeatRangePP,
    };
    if (result.scenes === 0) {
      return {
        verdict: {
          status: "inconclusive",
          statement: `Not run: ${scenes.length} synthetic scenes and ${predictions.length} classifier predictions are frozen, so the ${SYNTHETIC_LABEL} has nothing to score. No agreement is claimed.`,
        },
        findings,
        observations: [
          "The scene contract, BoundlessNYC adapter, metrics and fail-safe classifier mode exist and are unit-tested; the frozen inputs are deliberately empty until scenes are rendered and ingested.",
          `When scenes exist, the tripwire compares pervious-share error with the ${assumption("classification.synthetic_recovery_pp").value} pp the classifier disagrees with NLCD on real frames (C1). A tripped wire calls for investigating the classifier; it never changes a real-world claim by itself.`,
          NOT_REAL_WORLD,
        ],
        tables: [],
      };
    }
    return {
      verdict: {
        status: "descriptive",
        statement: `${SYNTHETIC_LABEL}: across ${result.scenes} nadir scenes, the classifier's composition differs from known ground truth by ${result.totalCompositionErrorPP} pp (half-L1) and its pervious share by ${result.perviousShareMaePP} pp on average (bias ${result.perviousShareBiasPP} pp). ${NOT_REAL_WORLD}`,
      },
      findings,
      observations: [
        NOT_REAL_WORLD,
        ...result.excludedScenes.map((e) => `Excluded ${e.sceneId}: ${e.reason}.`),
      ],
      tables: [
        {
          title: "Per-class error against known composition (pp)",
          columns: ["class", "mean absolute error", "bias"],
          rows: COMPOSITION_KEYS.map((k) => [k, result.perClassMaePP![k], result.perClassBiasPP![k]]),
        },
        {
          title: "Estimated composition transfer, from (row) → to (column), pp — a trend, not a confusion matrix",
          columns: ["from", ...COMPOSITION_KEYS],
          rows: COMPOSITION_KEYS.map((from) => [from, ...COMPOSITION_KEYS.map((to) => result.estimatedTransferPP![from][to])]),
        },
        {
          title: "Error by scene condition",
          columns: ["condition", "value", "scenes", "total error pp", "pervious MAE pp"],
          rows: result.byCondition.map((c) => [c.condition, c.value, c.scenes, c.totalCompositionErrorPP, c.perviousShareMaePP]),
        },
      ],
    };
  },
};
