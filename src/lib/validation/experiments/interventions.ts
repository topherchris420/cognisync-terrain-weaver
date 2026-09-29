import { solveForTarget } from "@/lib/catalyst";
import { classificationEnvelope, scenarioAreas, scenarioForAreas } from "@/lib/classification-envelope";
import { controlledComparison } from "@/lib/counterfactual/controlled";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import type { InterventionFeature } from "@/lib/counterfactual/types";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { bboxAreaKm2 } from "@/lib/geo";
import { routeWatershed } from "@/lib/hydrology/engine";
import type { ElevationGrid } from "@/lib/hydrology/types";
import { INTERVENTIONS, projectScore } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";
import type { Experiment, FixtureLoader } from "../experiment";
import { referenceAgreement, repeatStability } from "./classification";
import { demPath, elevationFromFixture, squareIntervention } from "../fixtures";
import { judgeHypothesis, MODEL_VERDICT_LABEL, type InterventionHypothesis } from "../hypothesis";
import { round } from "../metrics";
import { NAMED_STUDY_AREAS } from "../study-areas";

const AREA = NAMED_STUDY_AREAS.find((a) => a.id === "lower-manhattan-example")!;
const BBOX = AREA.bbox;
const AREA_M2 = bboxAreaKm2([[BBOX.west, BBOX.south], [BBOX.east, BBOX.north]]) * 1e6;
const SIZE = { low: 36, medium: 72, high: 120 } as const;

interface PairOptions {
  cover?: LandCover;
  rainfallMm?: number;
  resolution?: keyof typeof SIZE;
  elevation?: ElevationGrid;
  effectiveness?: number;
}

/** Route NOW and POSSIBLE under one sealed forcing and verify the pair is controlled. */
function routedPair(load: FixtureLoader, features: InterventionFeature[], options: PairOptions = {}) {
  const resolution = options.resolution ?? "medium";
  const n = SIZE[resolution];
  const elevation = options.elevation ?? elevationFromFixture(load, AREA.id, "terrarium", n);
  const scaled = features.map((f) => ({
    ...f,
    parameters: { ...f.parameters, retentionFractionDelta: f.parameters.retentionFractionDelta * (options.effectiveness ?? 1) },
  }));
  const input = {
    bbox: BBOX,
    rainfallDepthMm: options.rainfallMm ?? 50,
    durationMinutes: 60,
    resolution,
    landCover: options.cover ?? EXAMPLE_ANALYSIS.land_cover,
    stormHash: `storm:${options.rainfallMm ?? 50}`,
    elevation,
  };
  const now = routeWatershed({ ...input, surfaceId: "now", surfaceHash: "now" });
  const possible = routeWatershed({ ...input, surfaceId: "possible", surfaceHash: "possible", modifiers: rasterizeSurfaceModifiers(scaled, BBOX, n, n), expectedElevationHash: now.elevationHash });
  const control = controlledComparison(now, possible);
  if (!control.valid) throw new Error(`Uncontrolled comparison: ${control.violations.join(" ")}`);
  const avoided = now.waterBalance.runoffM3 - possible.waterBalance.runoffM3;
  const outflowNow = now.metadata.outflow_volume_m3 ?? 0;
  const outflowPossible = possible.metadata.outflow_volume_m3 ?? 0;
  return {
    now,
    possible,
    control,
    avoidedM3: avoided,
    reductionPercent: (avoided / now.waterBalance.runoffM3) * 100,
    outflowReductionPercent: outflowNow > 0 ? ((outflowNow - outflowPossible) / outflowNow) * 100 : 0,
  };
}

/* --------------------------------------------- I1 an explicit hypothesis */

const I1: InterventionHypothesis = {
  statement: "Converting 1,500 m² of eligible pavement to bioswale on the example extent reduces modeled routed runoff under the sealed 50 mm, 60-minute storm by at least 8%.",
  metric: "routed runoff reduction (%)",
  comparison: ">=",
  threshold: 8,
};

export const bioswaleHypothesis: Experiment = {
  spec: {
    id: "interventions/I1-bioswale-1500m2",
    domain: "interventions",
    title: "Hypothesis: a 1,500 m² bioswale cuts routed runoff by 8%",
    question: "Does a 1,500 m² bioswale on the Lower Manhattan example extent reduce routed runoff under the sealed 50 mm storm by at least 8%?",
    hypothesis: I1.statement,
    tier: "internal-consistency",
    inputs: [demPath(AREA.id)],
    conditions: { extent: AREA.id, rainfallMm: 50, durationMin: 60, resolution: "medium (72×72)", cover: "illustrative example", interventionAreaM2: 1500 },
    split: "None: a model experiment. Support here is support within the model, not evidence of a real-world outcome.",
    metrics: ["routed runoff reduction (%)", "outflow reduction (%)", "controlled-variable check", "area needed to reach the threshold"],
    limitations: [
      "Illustrative land cover; eligibility is assumed, not evaluated against mapped pavement.",
      "The bioswale retention value is a scenario assumption with no recorded source (see the assumption registry).",
      "The model credits only rain landing on the swale; real swales also capture run-on from a contributing area, and fail once full.",
    ],
  },
  run(load) {
    const feature = squareIntervention("bioswales", BBOX, 1500);
    const pair = routedPair(load, [feature]);
    const verdict = judgeHypothesis(I1, pair.reductionPercent);
    const perM2 = pair.avoidedM3 / feature.eligibility.validAreaM2;
    const needed = ((I1.threshold / 100) * pair.now.waterBalance.runoffM3) / perM2;
    const pavement = AREA_M2 * (EXAMPLE_ANALYSIS.land_cover.pavement / 100);
    return {
      verdict: {
        status: verdict === "supported-by-model" ? "supported" : verdict === "inconclusive" ? "inconclusive" : "not-supported",
        statement: `${MODEL_VERDICT_LABEL[verdict]}. The bioswale reduces routed runoff by ${round(pair.reductionPercent, 2)}% (${round(pair.avoidedM3, 1)} of ${Math.round(pair.now.waterBalance.runoffM3).toLocaleString("en-US")} m³), ${pair.reductionPercent >= I1.threshold ? "meeting" : "below"} the 8% threshold. Reaching 8% would take about ${Math.round(needed).toLocaleString("en-US")} m² of bioswale, ${round((needed / pavement) * 100, 0)}% of the extent's classified pavement.`,
      },
      findings: {
        reductionPercent: round(pair.reductionPercent, 3),
        avoidedM3: round(pair.avoidedM3, 1),
        nowRunoffM3: Math.round(pair.now.waterBalance.runoffM3),
        outflowReductionPercent: round(pair.outflowReductionPercent, 3),
        areaNeededForThresholdM2: Math.round(needed),
        shareOfPavementNeeded: round(needed / pavement, 3),
        controlledComparisonValid: pair.control.valid,
        verdict,
      },
      observations: [
        `Controlled comparison: ${pair.control.fixed.length} fixed variables identical (${pair.control.fixed.map((v) => v.label.toLowerCase()).join(", ")}); only the intervention surface differs.`,
        pair.reductionPercent < I1.threshold
          ? "This negative result is kept deliberately: a single street-scale bioswale is small against the runoff of a whole 0.85 km² extent, and a claim of district-scale benefit from it would be false within the model itself."
          : "The threshold is met within the model.",
        "Support within the model is not evidence about a real bioswale. That would require monitored inflow/outflow data for installed practices.",
      ],
      tables: [
        {
          title: "NOW / POSSIBLE under the same sealed storm",
          columns: ["quantity", "NOW", "POSSIBLE", "change"],
          rows: [
            ["rainfall m³", Math.round(pair.now.waterBalance.rainfallM3), Math.round(pair.possible.waterBalance.rainfallM3), 0],
            ["retained m³", Math.round(pair.now.waterBalance.infiltratedM3), Math.round(pair.possible.waterBalance.infiltratedM3), round(pair.possible.waterBalance.infiltratedM3 - pair.now.waterBalance.infiltratedM3, 1)],
            ["runoff m³", Math.round(pair.now.waterBalance.runoffM3), Math.round(pair.possible.waterBalance.runoffM3), round(-pair.avoidedM3, 1)],
            ["ponded m³", Math.round(pair.now.waterBalance.pondedM3 ?? 0), Math.round(pair.possible.waterBalance.pondedM3 ?? 0), round((pair.possible.waterBalance.pondedM3 ?? 0) - (pair.now.waterBalance.pondedM3 ?? 0), 1)],
            ["outflow m³", Math.round(pair.now.metadata.outflow_volume_m3 ?? 0), Math.round(pair.possible.metadata.outflow_volume_m3 ?? 0), round((pair.possible.metadata.outflow_volume_m3 ?? 0) - (pair.now.metadata.outflow_volume_m3 ?? 0), 1)],
          ],
        },
      ],
    };
  },
};

/* --------------------------------------------- I2 robustness of a plan */

const PLAN_AREA_M2 = 20_000;
const MIN_REDUCTION = 2;

export const planRobustness: Experiment = {
  spec: {
    id: "interventions/I2-plan-robustness",
    domain: "interventions",
    title: "Does a planning conclusion survive plausible uncertainty?",
    question: `For ${PLAN_AREA_M2.toLocaleString("en-US")} m² of converted pavement on the example extent, do two conclusions survive bounded changes to classification, retention effectiveness, cost, rainfall, resolution and elevation source: (A) either option reduces routed runoff by at least ${MIN_REDUCTION}%; (B) street trees avoid more runoff per installed dollar than bioswales?`,
    hypothesis: `Both conclusions hold under every tested perturbation.`,
    tier: "internal-consistency",
    inputs: [demPath(AREA.id)],
    conditions: { extent: AREA.id, baseline: "50 mm, medium resolution, Terrarium, registered coefficients and costs", combination: "one perturbation at a time, plus one explicitly labelled pessimistic combination" },
    split: "None: bounded sensitivity analysis. No probability distribution is implied.",
    metrics: ["runoff reduction (%) per option", "avoided m³ per $1,000 installed", "whether each conclusion holds"],
    limitations: [
      "Perturbation sizes are chosen to be plausible, not estimated: ±5 pp cover (compare classification/C1 and C2), −50% effectiveness, +20% cost, 2× and 4× rainfall.",
      "Perturbations are applied one at a time; their joint distribution is unknown, so no combined probability is reported.",
      "The volume conclusion is a land-budget result: in this model terrain decides where water goes, not how much runs off.",
    ],
  },
  run(load) {
    const trees = squareIntervention("street_trees", BBOX, PLAN_AREA_M2);
    const swales = squareIntervention("bioswales", BBOX, PLAN_AREA_M2);
    const shift = (dv: number): LandCover => ({ ...EXAMPLE_ANALYSIS.land_cover, vegetation: EXAMPLE_ANALYSIS.land_cover.vegetation + dv, pavement: EXAMPLE_ANALYSIS.land_cover.pavement - dv });
    const cases: Array<{ label: string; options: PairOptions; treeCost?: number; swaleCost?: number }> = [
      { label: "baseline", options: {} },
      { label: "vegetation −5 pp, pavement +5 pp", options: { cover: shift(-5) } },
      { label: "vegetation +5 pp, pavement −5 pp", options: { cover: shift(5) } },
      { label: "retention effectiveness −50%", options: { effectiveness: 0.5 } },
      { label: "all unit costs +20%", options: {}, treeCost: 1.2, swaleCost: 1.2 },
      { label: "tree cost +20% only", options: {}, treeCost: 1.2 },
      { label: "bioswale cost −20% only", options: {}, swaleCost: 0.8 },
      { label: "rainfall 100 mm", options: { rainfallMm: 100 } },
      { label: "rainfall 200 mm", options: { rainfallMm: 200 } },
      { label: "low resolution (36)", options: { resolution: "low" } },
      { label: "high resolution (120)", options: { resolution: "high" } },
      { label: "USGS 3DEP elevation", options: { elevation: elevationFromFixture(load, AREA.id, "3dep", 72) } },
      { label: "pessimistic combination (veg −5, effectiveness −50%, costs +20%)", options: { cover: shift(-5), effectiveness: 0.5 }, treeCost: 1.2, swaleCost: 1.2 },
    ];
    const rows = cases.map((c) => {
      const t = routedPair(load, [trees], c.options);
      const s = routedPair(load, [swales], c.options);
      const tCost = trees.eligibility.validAreaM2 * INTERVENTIONS.street_trees.unitCostUSD * (c.treeCost ?? 1);
      const sCost = swales.eligibility.validAreaM2 * INTERVENTIONS.bioswales.unitCostUSD * (c.swaleCost ?? 1);
      const tPer = (t.avoidedM3 / tCost) * 1000;
      const sPer = (s.avoidedM3 / sCost) * 1000;
      return { label: c.label, t, s, tPer, sPer, a: t.reductionPercent >= MIN_REDUCTION && s.reductionPercent >= MIN_REDUCTION, b: tPer > sPer };
    });
    const aHolds = rows.filter((r) => r.a).length;
    const bHolds = rows.filter((r) => r.b).length;
    const breaks = (key: "a" | "b") => rows.filter((r) => !r[key]).map((r) => r.label);
    const robust = aHolds === rows.length && bHolds === rows.length;
    return {
      verdict: {
        status: robust ? "supported" : "not-supported",
        statement: `Conclusion A (≥ ${MIN_REDUCTION}% reduction) holds in ${aHolds} of ${rows.length} cases${breaks("a").length ? `; it fails under: ${breaks("a").join("; ")}` : ""}. Conclusion B (trees avoid more runoff per dollar) holds in ${bHolds} of ${rows.length}${breaks("b").length ? `; it fails under: ${breaks("b").join("; ")}` : ""}.`,
      },
      findings: {
        cases: rows.length,
        conclusionAHolds: aHolds,
        conclusionBHolds: bHolds,
        baselineTreesReductionPercent: round(rows[0].t.reductionPercent, 2),
        baselineSwalesReductionPercent: round(rows[0].s.reductionPercent, 2),
        baselineTreesM3PerThousandUSD: round(rows[0].tPer, 3),
        baselineSwalesM3PerThousandUSD: round(rows[0].sPer, 3),
        terrainSpreadPercentPoints: round(Math.max(...[0, 9, 10, 11].map((i) => rows[i].s.reductionPercent)) - Math.min(...[0, 9, 10, 11].map((i) => rows[i].s.reductionPercent)), 3),
      },
      observations: [
        "Runoff volume does not depend on terrain in this model; resolution and elevation source change only where water goes and how much ponds. Their small effect on reduction comes from how the drawing meets the grid.",
        "The cost-effectiveness ranking rests entirely on two unsourced unit costs and one unsourced bioswale retention value. It is conditional on the registry, not a finding about the world.",
        "Effectiveness was reduced for both options together, so it cannot flip their ranking; a result that depends on the bioswale value alone would need a separate test.",
      ],
      tables: [
        {
          title: `${PLAN_AREA_M2.toLocaleString("en-US")} m² converted from pavement: routed results`,
          columns: ["perturbation", "trees reduction %", "bioswales reduction %", "trees m³ per $1k", "bioswales m³ per $1k", "A holds", "B holds"],
          rows: rows.map((r) => [r.label, round(r.t.reductionPercent, 2), round(r.s.reductionPercent, 2), round(r.tPer, 3), round(r.sPer, 3), r.a ? "yes" : "NO", r.b ? "yes" : "NO"]),
        },
      ],
    };
  },
};

/* ------------------------------ I3 classification uncertainty propagated */

export const uncertaintyPropagation: Experiment = {
  spec: {
    id: "interventions/I3-classification-uncertainty",
    domain: "interventions",
    title: "Does the planning conclusion survive measured classification error?",
    question: "When the vegetation/pavement split is moved by the amount the classifier has actually been observed to err, do the score, the 50 mm runoff and a Catalyst plan's target-score conclusion change?",
    hypothesis: "A Catalyst least-cost plan for +10 score points still reaches its target when the pervious share is off by the benchmark-derived error.",
    tier: "internal-consistency",
    inputs: ["scan-feed.json", "nlcd-2021.json"],
    conditions: { covers: "illustrative example; mean of the 24-times-classified Lower Manhattan frame", rainfallMm: 50, plan: "solveForTarget(cover, base + 10)" },
    split: "Error ranges come from classification/C1 and C2 on the same fixtures; nothing is tuned.",
    metrics: ["pavement, score and runoff ranges", "achieved score of the fixed built plan across the range", "whether the target is still reached"],
    limitations: [
      "The ranges are sensitivity ranges from measured behaviour, not confidence intervals.",
      "Only the vegetation/pavement split is perturbed; water error (the largest in C2) is reported by C2 but not propagated here.",
      "The built plan is held fixed in square metres; only the estimate of what surrounds it changes.",
    ],
  },
  run(load) {
    const c1 = referenceAgreement.run(load).findings;
    const c2 = repeatStability.run(load).findings;
    const ranges = [
      { pp: Math.round(Number(c1.perviousMaePP)), kind: "benchmark-derived" as const, label: "NLCD mean absolute pervious error", source: "classification/C1-nlcd-agreement" },
      { pp: Math.round(Number(c2.perviousRangePP) / 2), kind: "repeat-run" as const, label: "half the repeat-run pervious range", source: "classification/C2-repeat-stability" },
    ];
    const frame = load<Array<{ bbox: unknown; land_cover: LandCover; status: string; location_label: string | null }>>("scan-feed.json").data.filter(
      (r) => JSON.stringify(r.bbox) === JSON.stringify([[-74.02659936523506, 40.70448010071368], [-73.98540063476634, 40.72111885979098]]),
    );
    const meanCover = Object.fromEntries((["vegetation", "soil", "buildings", "pavement", "water"] as const).map((k) => [k, frame.reduce((s, r) => s + r.land_cover[k], 0) / frame.length])) as LandCover;
    const covers = [
      { label: "example (illustrative)", cover: EXAMPLE_ANALYSIS.land_cover },
      { label: `Lower Manhattan frame, mean of ${frame.length} classifications`, cover: meanCover },
    ];
    const rows = covers.flatMap(({ label, cover }) => {
      const base = projectScore(cover, { street_trees: 0, bioswales: 0, permeable_pavement: 0, green_roofs: 0 });
      const plan = solveForTarget(cover, Math.min(100, base + 10), AREA_M2);
      const built = scenarioAreas(cover, plan.scenario, AREA_M2);
      return ranges.map((range) => {
        const envelope = classificationEnvelope(cover, AREA_M2, 50, range, plan.scenario);
        const achieved = envelope.rows.map((r) => projectScore(r.cover, scenarioForAreas(r.cover, built, AREA_M2)));
        const hypothesis: InterventionHypothesis = { statement: "plan reaches target", metric: "score", comparison: ">=", threshold: plan.target - 0.05 };
        const verdict = judgeHypothesis(hypothesis, achieved[1], { min: Math.min(...achieved), max: Math.max(...achieved) });
        return { label, range, envelope, plan, achieved, verdict };
      });
    });
    const unstable = rows.filter((r) => r.verdict !== "supported-by-model");
    return {
      verdict: {
        status: unstable.length === 0 ? "supported" : "not-supported",
        statement: unstable.length === 0
          ? "Every tested plan still reaches its target across the measured classification error."
          : `${unstable.length} of ${rows.length} plan/error combinations become inconclusive: with the pervious share off by the measured amount, the same built plan ${unstable.length === rows.length ? "no longer reliably" : "does not always"} reach its target score. A plan sized exactly to a target inherits the classifier's error.`,
      },
      findings: {
        benchmarkErrorPP: ranges[0].pp,
        repeatRunErrorPP: ranges[1].pp,
        combinations: rows.length,
        combinationsInconclusive: unstable.length,
        exampleScoreMin: round(rows[0].envelope.score.min, 1),
        exampleScoreMax: round(rows[0].envelope.score.max, 1),
        exampleNowRunoffMinM3: Math.round(rows[0].envelope.nowRunoffM3.min),
        exampleNowRunoffMaxM3: Math.round(rows[0].envelope.nowRunoffM3.max),
        exampleAchievedMin: round(Math.min(...rows[0].achieved), 1),
        exampleTarget: round(rows[0].plan.target, 1),
      },
      observations: [
        `Measured error ranges: ±${ranges[0].pp} pp (${ranges[0].label}) and ±${ranges[1].pp} pp (${ranges[1].label}).`,
        ...rows.map((r) => `${r.label}, ±${r.range.pp} pp: pavement ${round(r.envelope.pavementPercent.min, 1)}–${round(r.envelope.pavementPercent.max, 1)}%, score ${round(r.envelope.score.min, 1)}–${round(r.envelope.score.max, 1)}, NOW 50 mm runoff ${Math.round(r.envelope.nowRunoffM3.min).toLocaleString("en-US")}–${Math.round(r.envelope.nowRunoffM3.max).toLocaleString("en-US")} m³; plan targets ${round(r.plan.target, 1)} and achieves ${round(Math.min(...r.achieved), 1)}–${round(Math.max(...r.achieved), 1)} → ${MODEL_VERDICT_LABEL[r.verdict]}.`),
        "Design consequence: a target should be read as reached only if it is reached across the measured error range, not at the central estimate alone.",
      ],
      tables: [
        {
          title: "Envelopes (central estimate in brackets)",
          columns: ["cover", "error range", "score", "NOW runoff m³", "POSSIBLE runoff m³", "achieved score", "target", "conclusion"],
          rows: rows.map((r) => [
            r.label,
            `±${r.range.pp} pp (${r.range.kind})`,
            `${round(r.envelope.score.min, 1)}–${round(r.envelope.score.max, 1)} (${round(r.envelope.score.central, 1)})`,
            `${Math.round(r.envelope.nowRunoffM3.min)}–${Math.round(r.envelope.nowRunoffM3.max)}`,
            `${Math.round(r.envelope.possibleRunoffM3.min)}–${Math.round(r.envelope.possibleRunoffM3.max)}`,
            `${round(Math.min(...r.achieved), 1)}–${round(Math.max(...r.achieved), 1)}`,
            round(r.plan.target, 1),
            MODEL_VERDICT_LABEL[r.verdict],
          ]),
        },
      ],
    };
  },
};
