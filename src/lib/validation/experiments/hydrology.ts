import { ABSORPTION_WEIGHTS } from "@/lib/absorption";
import { deriveScenarioFromFeatures } from "@/lib/counterfactual/projected-metrics";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { bboxAreaKm2 } from "@/lib/geo";
import { routeWatershed } from "@/lib/hydrology/engine";
import { LOCAL_GRID } from "@/lib/hydrology/types";
import { compareStorm, STORM_DEPTHS_MM } from "@/lib/paired-storm";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { BASELINE_COVER } from "@/lib/baseline";
import type { LandCover } from "@/lib/types";
import type { Experiment } from "../experiment";
import { COVER_KEYS, type FeedRow } from "../feed";
import { demPath, elevationFromFixture, squareIntervention } from "../fixtures";
import { mae, mean, round } from "../metrics";
import { NAMED_STUDY_AREAS } from "../study-areas";

const EXAMPLE_AREA = NAMED_STUDY_AREAS.find((a) => a.id === "lower-manhattan-example")!;

/* ------------------------------------------ H1 cross-model consistency */

/** Area the grid credits: coverage-weighted cells (retention change ÷ the feature's full change). */
function creditedArea(cells: Array<{ retentionFractionDelta: number }>, fullDelta: number, cellAreaM2: number): number {
  return cells.reduce((sum, cell) => sum + cell.retentionFractionDelta / fullDelta, 0) * cellAreaM2;
}

export const crossModelConsistency: Experiment = {
  spec: {
    id: "hydrology/H1-cross-model-consistency",
    domain: "hydrology",
    title: "Do the bulk budget and the routing engine agree on the same inputs?",
    question: "For identical land cover, extent and rainfall, do the lumped land budget and the D8 routing engine retain the same water, and credit the same drawn intervention with the same avoided runoff?",
    hypothesis: "Without interventions, routed retained volume equals bulk retained volume (both apply the registered retention weights to the same land area), and a drawn intervention avoids the same runoff in both models within 5%.",
    tier: "internal-consistency",
    inputs: ["scan-feed.json", demPath(EXAMPLE_AREA.id)],
    conditions: { rainfallMm: 50, extent: "lower-manhattan-example", resolution: "medium (72×72)", interventionAreaM2: 1500 },
    split: "None: a consistency check across the model's own components.",
    metrics: ["retained-volume gap as % of frame rainfall", "routed ÷ bulk avoided runoff for the same drawing", "rasterized ÷ drawn intervention area"],
    limitations: [
      "Agreement between two parts of the instrument says nothing about agreement with nature.",
      "Uses real classifier compositions from the feed as inputs only; their accuracy is tested elsewhere (classification/C1, C2).",
    ],
  },
  run(load) {
    const feed = load<FeedRow[]>("scan-feed.json").data;
    const seen = new Set<string>();
    const covers: Array<{ label: string; cover: LandCover }> = [
      { label: "example (illustrative)", cover: EXAMPLE_ANALYSIS.land_cover },
      { label: "1609 benchmark (reconstructed)", cover: BASELINE_COVER },
    ];
    for (const row of feed) {
      const key = COVER_KEYS.map((k) => row.land_cover[k]).join("/");
      if (seen.has(key) || row.land_cover.water >= 100) continue;
      seen.add(key);
      covers.push({ label: row.location_label ?? "(untitled scan)", cover: row.land_cover });
    }
    const bbox = EXAMPLE_AREA.bbox;
    const areaM2 = bboxAreaKm2([[bbox.west, bbox.south], [bbox.east, bbox.north]]) * 1e6;
    const elevation = elevationFromFixture(load, EXAMPLE_AREA.id, "terrarium", 72);
    const base = { bbox, rainfallDepthMm: 50, durationMinutes: 60, resolution: "medium" as const, surfaceId: "now" as const, stormHash: "h1", surfaceHash: "h1-now", elevation };
    const rows = covers.map(({ label, cover }) => {
      const bulk = compareStorm(cover, EMPTY_SCENARIO, areaM2, 50);
      const routed = routeWatershed({ ...base, landCover: cover });
      const rainOnFrame = routed.waterBalance.rainfallM3;
      const gapPP = ((routed.waterBalance.infiltratedM3 - bulk.now.retainedM3) / rainOnFrame) * 100;
      return { label, water: cover.water, bulkRetained: bulk.now.retainedM3, routedRetained: routed.waterBalance.infiltratedM3, gapPP };
    });
    const gaps = rows.map((r) => r.gapPP);
    const dry = rows.filter((r) => r.water === 0).map((r) => r.gapPP);
    const wet = rows.filter((r) => r.water > 0).map((r) => r.gapPP);

    // Same drawing, both models.
    const cover = EXAMPLE_ANALYSIS.land_cover;
    const now = routeWatershed({ ...base, landCover: cover });
    const interventionRows = (["street_trees", "bioswales"] as const).map((type) => {
      const feature = squareIntervention(type, bbox, 1500);
      const modifiers = rasterizeSurfaceModifiers([feature], bbox, 72, 72);
      const possible = routeWatershed({ ...base, landCover: cover, modifiers, surfaceId: "possible", surfaceHash: `h1-${type}` });
      const routedAvoided = now.waterBalance.runoffM3 - possible.waterBalance.runoffM3;
      const scenario = deriveScenarioFromFeatures([feature], cover, areaM2);
      const bulkAvoided = compareStorm(cover, scenario, areaM2, 50).avoidedRunoffM3;
      return { type, drawn: feature.eligibility.validAreaM2, rasterized: creditedArea(modifiers.cells, feature.parameters.retentionFractionDelta, areaM2 / (72 * 72)), routedAvoided, bulkAvoided, ratio: routedAvoided / bulkAvoided };
    });
    const rasterRows = ([36, 72, 120] as const).map((size) => {
      const feature = squareIntervention("bioswales", bbox, 1500);
      const cells = rasterizeSurfaceModifiers([feature], bbox, size, size).cells;
      return { size, ratio: creditedArea(cells, feature.parameters.retentionFractionDelta, areaM2 / (size * size)) / feature.eligibility.validAreaM2 };
    });
    const maxRatioError = Math.max(...interventionRows.map((r) => Math.abs(r.ratio - 1)));
    const maxRasterError = Math.max(...rasterRows.map((r) => Math.abs(r.ratio - 1)));
    const consistent = Math.max(...gaps.map(Math.abs)) < 1e-6 && maxRatioError <= 0.05;
    return {
      verdict: consistent
        ? { status: "supported", statement: "Routed and bulk retention agree exactly on the same land, and both credit a drawn intervention within 5%." }
        : {
            status: "not-supported",
            statement: `The two water models disagree on identical inputs: routed retention differs from bulk retention by up to ${round(Math.max(...gaps.map(Math.abs)), 1)} pp of frame rainfall, and the routed engine credits the same drawn intervention with ${round(Math.min(...interventionRows.map((r) => r.ratio)), 2)}–${round(Math.max(...interventionRows.map((r) => r.ratio)), 2)}× the bulk model's avoided runoff.`,
          },
      findings: {
        compositions: rows.length,
        maxRetentionGapPP: round(Math.max(...gaps.map(Math.abs)), 2),
        meanRetentionGapPP: round(mean(gaps), 2),
        meanGapNoWaterPP: dry.length ? round(mean(dry), 2) : null,
        meanGapWithWaterPP: wet.length ? round(mean(wet), 2) : null,
        treesRoutedOverBulk: round(interventionRows[0].ratio, 3),
        bioswalesRoutedOverBulk: round(interventionRows[1].ratio, 3),
        rasterAreaRatio36: round(rasterRows[0].ratio, 3),
        rasterAreaRatio72: round(rasterRows[1].ratio, 3),
        rasterAreaRatio120: round(rasterRows[2].ratio, 3),
        maxRasterAreaError: round(maxRasterError, 3),
        routingVegetationC: round(1 - (routeWatershed({ ...base, landCover: { vegetation: 100, soil: 0, buildings: 0, pavement: 0, water: 0 } }).waterBalance.infiltratedM3 / now.waterBalance.rainfallM3), 3),
        registeredVegetationC: round(1 - ABSORPTION_WEIGHTS.vegetation, 3),
      },
      observations: [
        `Retention gap without open water: ${dry.length ? round(mean(dry), 2) : "n/a"} pp; with open water in the frame: ${wet.length ? round(mean(wet), 2) : "n/a"} pp of frame rainfall.`,
        `A 1,500 m² bioswale: routed avoided runoff ${round(interventionRows[1].routedAvoided, 1)} m³ vs bulk ${round(interventionRows[1].bulkAvoided, 1)} m³. Street trees: ${round(interventionRows[0].routedAvoided, 1)} vs ${round(interventionRows[0].bulkAvoided, 1)} m³.`,
        `Rasterization at 36/72/120 cells credits a 1,500 m² square with ${round(rasterRows[0].ratio * 100, 1)}% / ${round(rasterRows[1].ratio * 100, 1)}% / ${round(rasterRows[2].ratio * 100, 1)}% of its drawn area (before the area-weighted revision: 174% / 87% / 94%; experiments/revisions/before-findings.json).`,
      ],
      tables: [
        {
          title: "Retained volume at 50 mm on the example extent (m³)",
          columns: ["composition", "water %", "bulk retained", "routed retained", "gap (pp of rainfall)"],
          rows: rows.map((r) => [r.label, r.water, Math.round(r.bulkRetained), Math.round(r.routedRetained), round(r.gapPP, 2)]),
        },
        {
          title: "Same 1,500 m² drawing in both models (50 mm)",
          columns: ["intervention", "drawn m²", "rasterized m²", "routed avoided m³", "bulk avoided m³", "routed ÷ bulk"],
          rows: interventionRows.map((r) => [r.type, Math.round(r.drawn), Math.round(r.rasterized), round(r.routedAvoided, 1), round(r.bulkAvoided, 1), round(r.ratio, 3)]),
        },
      ],
    };
  },
};

/* --------------------------------------- H2 curve-number reference model */

/** NRCS TR-55 runoff depth (mm) for rainfall P (mm) and curve number CN, Ia = 0.2S. */
export function curveNumberRunoffMm(rainfallMm: number, cn: number): number {
  const s = 25400 / cn - 254;
  const ia = 0.2 * s;
  return rainfallMm <= ia ? 0 : (rainfallMm - ia) ** 2 / (rainfallMm + 0.8 * s);
}

/**
 * TR-55 Table 2-2a curve numbers. Pervious classes list soil groups A–D;
 * pavement spans "paved parking lots, roofs, driveways" (98) and "streets and
 * roads, paved, open ditches" (83/89/92/93); roofs have the single value 98.
 */
export const TR55_CN: Record<"vegetation" | "soil" | "buildings" | "pavement", number[]> = {
  vegetation: [39, 61, 74, 80], // open space, good condition (>75% grass cover)
  soil: [77, 86, 91, 94], // newly graded areas, pervious only, no vegetation
  buildings: [98],
  pavement: [98, 83, 89, 92, 93],
};

export const curveNumberBenchmark: Experiment = {
  spec: {
    id: "hydrology/H2-curve-number-benchmark",
    domain: "hydrology",
    title: "Fixed coefficients against the NRCS curve-number method",
    question: "Across rainfall depths of 10–200 mm, does the fixed-coefficient runoff fraction for each surface fall inside the envelope an independent empirical method gives across soil groups A–D?",
    hypothesis: "For every class and depth, the fixed runoff coefficient lies within the TR-55 curve-number envelope (soil groups A–D).",
    tier: "reference-model",
    inputs: [],
    conditions: { depthsMm: STORM_DEPTHS_MM.join(","), initialAbstraction: "0.2S", reference: "USDA NRCS TR-55 (1986) Table 2-2a" },
    split: "None: comparison with a published model; no parameter was adjusted.",
    metrics: ["runoff fraction by class and depth, model vs CN envelope", "share of depths outside the envelope per class", "composite runoff fraction for the example cover"],
    limitations: [
      "The curve-number method is itself an empirical model fitted to observed watershed data; it is a reference model, not an observation of any site here.",
      "Soil group, antecedent moisture and cover condition are unknown for scanned sites; the A–D envelope brackets them rather than identifying them.",
      "TR-55 does not separate roofs from pavement; both use CN 98.",
    ],
  },
  run() {
    const classes = ["vegetation", "soil", "buildings", "pavement"] as const;
    const table: Array<Array<string | number>> = [];
    const outside: Record<string, number> = {};
    const deviation: Record<string, number[]> = {};
    for (const cls of classes) {
      let count = 0;
      for (const depth of STORM_DEPTHS_MM) {
        const fractions = TR55_CN[cls].map((cn) => curveNumberRunoffMm(depth, cn) / depth);
        const lo = Math.min(...fractions);
        const hi = Math.max(...fractions);
        const model = 1 - ABSORPTION_WEIGHTS[cls];
        const status = model < lo - 1e-9 ? "below" : model > hi + 1e-9 ? "above" : "inside";
        if (status !== "inside") count += 1;
        (deviation[cls] ??= []).push(status === "above" ? model - hi : status === "below" ? model - lo : 0);
        table.push([cls, depth, round(model, 3), round(lo, 3), round(hi, 3), status]);
      }
      outside[cls] = count / STORM_DEPTHS_MM.length;
    }
    const cover = EXAMPLE_ANALYSIS.land_cover;
    const land = classes.reduce((s, k) => s + cover[k], 0);
    const composite = STORM_DEPTHS_MM.map((depth) => {
      const model = compareStorm(cover, EMPTY_SCENARIO, 1_000_000, depth);
      const byGroup = [0, 1, 2, 3].map((g) => classes.reduce((s, k) => s + (cover[k] / land) * curveNumberRunoffMm(depth, k === "vegetation" || k === "soil" ? TR55_CN[k][g] : 98), 0) / depth);
      return { depth, model: model.now.runoffM3 / model.rainfallVolumeM3, lo: Math.min(...byGroup), hi: Math.max(...byGroup), groupB: byGroup[1] };
    });
    const allInside = Object.values(outside).every((v) => v === 0);
    const compositeError = mae(composite.map((c) => c.model), composite.map((c) => c.groupB));
    return {
      verdict: allInside
        ? { status: "supported", statement: "Every fixed coefficient lies inside the curve-number envelope at every tested depth." }
        : {
            status: "not-supported",
            statement: `The fixed coefficients leave the curve-number envelope for ${Object.entries(outside).filter(([, v]) => v > 0).map(([k, v]) => `${k} (${round(v * 100, 0)}% of depths)`).join(", ")}. The linear model cannot reproduce the reference's depth dependence: it over-predicts pervious runoff in small storms and cannot show pervious surfaces saturating in large ones.`,
          },
      findings: {
        vegetationShareOfDepthsOutsideEnvelope: round(outside.vegetation, 2),
        soilShareOfDepthsOutsideEnvelope: round(outside.soil, 2),
        pavementShareOfDepthsOutsideEnvelope: round(outside.pavement, 2),
        buildingsShareOfDepthsOutsideEnvelope: round(outside.buildings, 2),
        exampleCompositeMaeVsGroupB: round(compositeError, 3),
        buildingsMaxAbsDeviation: round(Math.max(...deviation.buildings.map(Math.abs)), 3),
        pavementMaxAbsDeviation: round(Math.max(...deviation.pavement.map(Math.abs)), 3),
        exampleComposite10mmModel: round(composite[0].model, 3),
        exampleComposite10mmGroupB: round(composite[0].groupB, 3),
        exampleComposite200mmModel: round(composite[composite.length - 1].model, 3),
        exampleComposite200mmGroupB: round(composite[composite.length - 1].groupB, 3),
      },
      observations: [
        ...classes.map((cls) => {
          const d = deviation[cls];
          const worst = d.reduce((w, v) => (Math.abs(v) > Math.abs(w) ? v : w), 0);
          return `${cls}: fixed runoff fraction ${round(1 - ABSORPTION_WEIGHTS[cls], 2)}; outside the curve-number envelope at ${d.filter((v) => v !== 0).length} of ${d.length} depths; largest excursion ${worst > 0 ? "+" : ""}${round(worst, 3)} (${worst > 0 ? "model sheds more than the reference" : worst < 0 ? "model sheds less than the reference" : "none"}).`;
        }),
        `Example composition: the model sheds ${round(composite[0].model * 100, 0)}% of 10 mm and ${round(composite[composite.length - 1].model * 100, 0)}% of 200 mm; the soil-group-B reference sheds ${round(composite[0].groupB * 100, 0)}% and ${round(composite[composite.length - 1].groupB * 100, 0)}%. The fixed model has no depth dependence at all.`,
        "Consequence: avoided-runoff estimates for interventions scale exactly linearly with depth in this model. Under the reference, the relative benefit of converting pavement to vegetation depends on storm depth and soil group, which the instrument cannot currently represent.",
      ],
      tables: [
        { title: "Runoff fraction by surface and depth", columns: ["class", "depth mm", "model", "CN min (A–D)", "CN max (A–D)", "model is"], rows: table },
        {
          title: "Example composition: runoff ÷ rainfall on land",
          columns: ["depth mm", "model", "CN soil group B", "CN envelope"],
          rows: composite.map((c) => [c.depth, round(c.model, 3), round(c.groupB, 3), `${round(c.lo, 3)}–${round(c.hi, 3)}`]),
        },
      ],
    };
  },
};

export { LOCAL_GRID };
