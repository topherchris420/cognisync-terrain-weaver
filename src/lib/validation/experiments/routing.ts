import { routeAccumulation, routeTerrain } from "@/lib/hydrology/engine";
import { fillDepressions } from "@/lib/hydrology/conditioning";
import type { SimExtent } from "@/lib/hydrology/types";
import { bboxAreaKm2 } from "@/lib/geo";
import { runoffCoefficient } from "@/lib/simulation";
import type { LandCover } from "@/lib/types";
import type { Experiment, FixtureLoader, ResultTable } from "../experiment";
import { EVENTS, PRIMARY_DESCRIPTOR, type ValidationEvent } from "../events";
import { demPath, elevationFromFixture, hasThreeDep, studyAreas } from "../fixtures";
import { clusterBootstrap, mean, midRankPercentile, quantile, round, spearman, topShareOverlap } from "../metrics";
import { NAMED_STUDY_AREAS, type StudyArea } from "../study-areas";
import { nlcdReference, type NlcdGrid } from "../nlcd";

/* ------------------------------------------------------------- helpers */

const ones = (rows: number, cols: number) => Array.from({ length: rows }, () => Array<number>(cols).fill(1));

/**
 * Accumulation in upslope cells. The app applies one composite coefficient to
 * every unmodified cell, so its routed volumes are this grid times a constant:
 * identical ranks, identical hotspots.
 */
export function upslopeCells(values: number[][], variant: RoutingVariant = "app", generated?: number[][], cellAreaM2 = 1) {
  const rows = values.length;
  const cols = values[0].length;
  const water = generated ?? ones(rows, cols);
  if (variant === "app") {
    const routed = routeTerrain(values, water, cellAreaM2);
    return { receivers: routed.receivers, accumulation: routed.accumulation, terminal: routed.outflow, ponded: routed.pondedVolume, pondDepthM: routed.pondDepthM as number[][] | null };
  }
  const routed = routeAccumulation(variant === "filled" ? fillDepressions(values) : values, water);
  // Without storage, water terminates wherever it reaches a sink (edge outlet or interior pit).
  const terminal = routed.accumulation.map((row, r) => row.map((v, c) => (isSink(routed.receivers, r, c) ? v : 0)));
  return { receivers: routed.receivers, accumulation: routed.accumulation, terminal, ponded: 0, pondDepthM: null as number[][] | null };
}

/**
 * "app": the engine as shipped (v2, static fill-and-spill).
 * "unconditioned": the original v1 D8. "filled": plain filling, rejected by
 * the preregistered rule (PREREGISTRATION.md, Addendum 2) and kept for the record.
 */
export type RoutingVariant = "app" | "filled" | "unconditioned";

export function isSink(receivers: [number, number][][], row: number, col: number): boolean {
  const [r, c] = receivers[row][col];
  return r === row && c === col;
}

function onEdge(rows: number, cols: number, row: number, col: number) {
  return row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
}

/** Share of all generated water that ends in an interior sink rather than leaving the extent. */
/** Share of generated water that never leaves the extent: ends in interior sinks or is held in depressions. */
export function interiorSinkCapture(values: number[][], variant: RoutingVariant = "app") {
  const { receivers, terminal, ponded } = upslopeCells(values, variant);
  const rows = values.length;
  const cols = values[0].length;
  let trapped = 0;
  let interiorSinks = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (isSink(receivers, row, col) && !onEdge(rows, cols, row, col)) {
        interiorSinks += 1;
        trapped += terminal[row][col];
      }
    }
  }
  return { interiorSinkShare: interiorSinks / (rows * cols), trappedShare: (trapped + ponded) / (rows * cols) };
}

/* ------------------------------------------------ R1 synthetic terrains */

type Surface = (row: number, col: number) => number;

interface SyntheticCase {
  id: string;
  surface: Surface;
  /** Analytic downslope direction (d row, d col), or null where undefined. */
  downslope: ((row: number, col: number) => [number, number] | null) | null;
  /** Cells real water would finally reach. */
  outlets: (row: number, col: number, n: number) => boolean;
  expectation: string;
}

const N = 25;
const C0 = (N - 1) / 2;
/** Synthetic terrains sit 100 m above sea level so no cell counts as receiving water. */
const DATUM = 100;

const CASES: SyntheticCase[] = [
  {
    id: "uniform-slope",
    surface: (_r, c) => c,
    downslope: () => [0, -1],
    outlets: (_r, c) => c === 0,
    expectation: "every cell drains due west to the western edge",
  },
  {
    id: "bowl",
    surface: (r, c) => (r - C0) ** 2 + (c - C0) ** 2,
    downslope: (r, c) => (r === C0 && c === C0 ? null : [C0 - r, C0 - c]),
    outlets: (r, c) => (r - C0) ** 2 + (c - C0) ** 2 < C0 ** 2,
    expectation: "all water converges on the central depression and stays there",
  },
  {
    id: "ridge",
    surface: (_r, c) => -Math.abs(c - C0),
    downslope: (_r, c) => (c === C0 ? null : [0, c < C0 ? -1 : 1]),
    outlets: (_r, c, n) => c === 0 || c === n - 1,
    expectation: "two catchments of equal size, split along the ridge line",
  },
  {
    id: "converging-valley",
    surface: (r, c) => Math.abs(c - C0) + 0.2 * (N - 1 - r),
    downslope: (_r, c) => (c === C0 ? [1, 0] : [0.2, c < C0 ? 1 : -1]),
    outlets: (r, c) => r === N - 1 && c === C0,
    expectation: "side slopes feed a central channel that exits at the southern edge",
  },
  {
    id: "isolated-peak",
    surface: (r, c) => -Math.hypot(r - C0, c - C0),
    downslope: (r, c) => (r === C0 && c === C0 ? null : [r - C0, c - C0]),
    outlets: (r, c, n) => onEdge(n, n, r, c),
    expectation: "water sheds radially away from the peak to every edge",
  },
  {
    id: "flat",
    surface: () => 0,
    downslope: null,
    outlets: (r, c, n) => onEdge(n, n, r, c),
    expectation: "no preferred direction; physically, water ponds evenly or leaves by the edges",
  },
  {
    id: "slope-with-pit",
    surface: (r, c) => (r === 12 && c === 12 ? c - 5 : c),
    // The pit's own neighbours slope into it locally, so their analytic
    // direction is undefined here; the test is where the water ends up.
    downslope: (r, c) => (Math.abs(r - 12) <= 1 && Math.abs(c - 12) <= 1 ? null : [0, -1]),
    outlets: (_r, c) => c === 0,
    expectation: "a one-cell depression holds its 5 units, overflows, and the rest reaches the western edge",
  },
];

function angleDegrees(a: [number, number], b: [number, number]) {
  const dot = a[0] * b[0] + a[1] * b[1];
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return (Math.acos(Math.min(1, Math.max(-1, dot / norm))) * 180) / Math.PI;
}

export const syntheticRouting: Experiment = {
  spec: {
    id: "routing/R1-synthetic-terrains",
    domain: "routing",
    title: "D8 routing on terrains with known answers",
    question: "On synthetic terrains whose drainage is known analytically, does D8 route water in the right direction, conserve it, and deliver it to the right outlets?",
    hypothesis: "On every case, D8 directions lie within 45° of the analytic downslope direction, and at least 99% of water reaches the analytically expected outlets.",
    tier: "synthetic-verification",
    inputs: [],
    conditions: { grid: `${N}×${N}`, generation: "1 unit per cell, cell area 1", variants: "original D8 (v1); plain fill (rejected); fill-and-spill (v2, shipped)" },
    split: "None: analytic verification.",
    metrics: ["mean and maximum angular deviation from analytic downslope (degrees)", "share of water reaching expected outlets", "share of cells that are interior sinks"],
    limitations: ["Synthetic surfaces verify the algorithm, not its fidelity to any real street network."],
  },
  run() {
    const variants: RoutingVariant[] = ["unconditioned", "filled", "app"];
    const evaluate = (sc: SyntheticCase, variant: RoutingVariant) => {
      const values = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => DATUM + sc.surface(r, c)));
      const routed = upslopeCells(values, variant);
      const angles: number[] = [];
      let delivered = 0;
      let conserved = routed.ponded;
      for (let r = 0; r < N; r += 1) {
        for (let c = 0; c < N; c += 1) {
          const sink = isSink(routed.receivers, r, c);
          conserved += routed.terminal[r][c];
          if (sc.outlets(r, c, N)) delivered += routed.terminal[r][c] + (routed.pondDepthM?.[r][c] ?? 0);
          const expected = sc.downslope?.(r, c) ?? null;
          if (!expected || sink) continue;
          const [nr, nc] = routed.receivers[r][c];
          angles.push(angleDegrees([nr - r, nc - c], expected));
        }
      }
      return {
        meanAngle: angles.length ? mean(angles) : null,
        maxAngle: angles.length ? Math.max(...angles) : null,
        delivered: delivered / (N * N),
        conservation: conserved / (N * N),
        interiorSinkShare: interiorSinkCapture(values, variant).interiorSinkShare,
      };
    };
    const rows = CASES.map((sc) => ({ id: sc.id, expectation: sc.expectation, ...Object.fromEntries(variants.map((v) => [v, evaluate(sc, v)])) }) as { id: string; expectation: string } & Record<RoutingVariant, ReturnType<typeof evaluate>>);
    const failed = (v: RoutingVariant) => rows.filter((r) => (r[v].maxAngle !== null && r[v].maxAngle > 45 + 1e-9) || r[v].delivered < 0.99).map((r) => r.id);
    const appFailures = failed("app");
    // The preregistered rule says "without degrading any other R1 case" and
    // does not say by how much. Both readings are computed and reported:
    // strict = any decrease; threshold = a case that passed (≥ 99%) now fails.
    const others = (id: string) => id !== "slope-with-pit" && id !== "flat";
    const strictlyDecreased = (v: RoutingVariant) => rows.filter((r) => others(r.id) && r[v].delivered < r.unconditioned.delivered - 1e-9).map((r) => r.id);
    const degraded = (v: RoutingVariant) => rows.filter((r) => others(r.id) && r.unconditioned.delivered >= 0.99 && r[v].delivered < 0.99).map((r) => r.id);
    const adoptionPasses = (v: RoutingVariant) =>
      ["slope-with-pit", "flat"].every((id) => rows.find((r) => r.id === id)![v].delivered >= 0.99) && degraded(v).length === 0;
    const ridgeValues = Array.from({ length: N }, () => Array.from({ length: N }, (_, c) => DATUM - Math.abs(c - C0)));
    const ridgeRoute = upslopeCells(ridgeValues);
    let west = 0;
    for (let r = 0; r < N; r += 1) west += ridgeRoute.accumulation[r][0];
    const pct = (x: number) => `${round(x * 100, 1)}%`;
    return {
      verdict: appFailures.length === 0
        ? { status: "supported", statement: "The shipped routing matched every analytic case." }
        : {
            status: "not-supported",
            statement: `The shipped routing (fill-and-spill) fails ${appFailures.length} of ${rows.length} analytic cases (${appFailures.join(", ")}); the original D8 failed ${failed("unconditioned").length} (${failed("unconditioned").join(", ")}). Fill-and-spill fixed the pit and flat cases; the remaining failure is boundary behaviour.`,
          },
      findings: {
        cases: rows.length,
        failedCases: appFailures.length,
        failedCaseIds: appFailures.join(",") || null,
        failedCasesUnconditioned: failed("unconditioned").length,
        failedCasesFilled: failed("filled").length,
        adoptionRuleFillAndSpill: adoptionPasses("app"),
        adoptionRulePlainFill: adoptionPasses("filled"),
        plainFillDegradedCases: degraded("filled").join(",") || null,
        fillAndSpillStrictlyDecreasedCases: strictlyDecreased("app").join(",") || null,
        minConservation: round(Math.min(...rows.flatMap((r) => variants.map((v) => r[v].conservation))), 6),
        flatDelivered: round(rows.find((r) => r.id === "flat")!.app.delivered, 3),
        pitDelivered: round(rows.find((r) => r.id === "slope-with-pit")!.app.delivered, 3),
        bowlDeliveredPlainFill: round(rows.find((r) => r.id === "bowl")!.filled.delivered, 3),
        ridgeWestShare: round(west / (N * N), 3),
        maxDirectionErrorDeg: round(Math.max(...rows.map((r) => r.app.maxAngle ?? 0)), 1),
      },
      observations: [
        `Conservation holds exactly for every case and variant (minimum ${round(Math.min(...rows.flatMap((r) => variants.map((v) => r[v].conservation))), 6)}): all water ends at a sink or in depression storage.`,
        `Preregistered adoption rule (pit and flat ≥ 99%, no other case degraded): plain filling ${adoptionPasses("filled") ? "passes" : `fails — it degrades ${degraded("filled").join(", ")}`}; fill-and-spill ${adoptionPasses("app") ? "passes" : "fails"} when "degraded" means a case falling below the 99% pass mark.`,
        `The rule did not define "degraded". Under the strictest reading (any decrease at all) fill-and-spill ${strictlyDecreased("app").length ? `fails: ${strictlyDecreased("app").join(", ")} fell by ${round((1 - rows.find((r) => r.id === strictlyDecreased("app")[0])!.app.delivered) * 100, 1)} pp, which is rain landing exactly on the spill-level divide cells, where the analytic answer is itself indeterminate` : "also passes"}. It was adopted under the threshold reading; this ambiguity is recorded rather than resolved silently.`,
        `Bowl: original D8 ${pct(rows.find((r) => r.id === "bowl")!.unconditioned.delivered)}, plain fill ${pct(rows.find((r) => r.id === "bowl")!.filled.delivered)} (it spills the whole bowl to the boundary), fill-and-spill ${pct(rows.find((r) => r.id === "bowl")!.app.delivered)} (only rain on the four pour points leaves).`,
        `Flat: original D8 delivers ${pct(rows.find((r) => r.id === "flat")!.unconditioned.delivered)} because ${pct(rows.find((r) => r.id === "flat")!.unconditioned.interiorSinkShare)} of cells are sinks; fill-and-spill ${pct(rows.find((r) => r.id === "flat")!.app.delivered)}.`,
        `Ridge: ${pct(west / (N * N))} of water goes west against an analytic 50%; D8 breaks the ridge-line tie deterministically toward the west.`,
        "D8 represents every flow direction as one of eight, so deviations up to about 27° on radially symmetric surfaces are inherent to the method.",
        "Boundary behaviour (unfixed): a boundary cell cannot drain outward because the model knows nothing outside the extent. Where terrain slopes out of the extent, boundary cells pass water sideways along the edge (up to 90° from the true direction) and concentrate it at corners. Accumulation near the study boundary is unreliable.",
      ],
      tables: [
        {
          title: "Share of water ending in the analytically expected place",
          columns: ["case", "expectation", "original D8 (v1)", "plain fill (rejected)", "fill-and-spill (v2, shipped)", "v2 max angle °"],
          rows: rows.map((r) => [r.id, r.expectation, round(r.unconditioned.delivered, 3), round(r.filled.delivered, 3), round(r.app.delivered, 3), r.app.maxAngle === null ? null : round(r.app.maxAngle, 1)]),
        },
      ],
    };
  },
};

/* ------------------------------------------------ forcing */

function cellAreaOf(bbox: SimExtent, n: number): number {
  return (bboxAreaKm2([[bbox.west, bbox.south], [bbox.east, bbox.north]]) * 1e6) / (n * n);
}

/** Uniform runoff volume per cell (m³) for a runoff depth over the extent. */
function uniformRunoff(bbox: SimExtent, n: number, runoffDepthMm: number) {
  const volume = (runoffDepthMm / 1000) * cellAreaOf(bbox, n);
  return Array.from({ length: n }, () => Array<number>(n).fill(volume));
}

/** The app's default 50 mm design storm over a typical dense-urban composite (C = 0.7). */
export const DESIGN_RUNOFF_MM = 50 * 0.7;

/* ------------------------------------------------ R2 grid resolution */

/** Log specific catchment area (m² per m of cell width) sampled at n×n centres. */
function logSpecificAreaAt(values: number[][], bbox: SimExtent, n: number): number[] {
  const m = values.length;
  const routed = upslopeCells(values, "app", uniformRunoff(bbox, m, DESIGN_RUNOFF_MM), cellAreaOf(bbox, m));
  const width = Math.sqrt(cellAreaOf(bbox, m));
  const depth = DESIGN_RUNOFF_MM / 1000;
  const out: number[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const a = routed.accumulation[Math.floor(((r + 0.5) / n) * m)][Math.floor(((c + 0.5) / n) * m)];
      out.push(Math.log(Math.max(a, 1e-9) / depth / width));
    }
  }
  return out;
}

export const resolutionSensitivity: Experiment = {
  spec: {
    id: "routing/R2-resolution-sensitivity",
    domain: "routing",
    title: "Does routing change with grid resolution?",
    question: "On the same observed terrain, how similar are routed flow-concentration patterns at the app's low (36), medium (72) and high (120) resolutions, and how much water never leaves the extent?",
    hypothesis: null,
    tier: "repeated-measurement",
    inputs: NAMED_STUDY_AREAS.map((a) => demPath(a.id)),
    conditions: { dem: "Terrarium", forcing: `${DESIGN_RUNOFF_MM} mm runoff (50 mm storm, C 0.7)`, metric: "log specific catchment area, compared at 36×36 cell centres" },
    split: "None: descriptive sensitivity.",
    metrics: ["Spearman correlation of log specific catchment area", "top-10% hotspot overlap (Jaccard)", "share of water that never leaves the extent (interior sinks, or depression storage)"],
    limitations: ["Resolution changes both the DEM sampling and the D8 path geometry; they cannot be separated here."],
  },
  run(load) {
    const rows = NAMED_STUDY_AREAS.map((area) => {
      const grids = [36, 72, 120].map((size) => elevationFromFixture(load, area.id, "terrarium", size));
      const specific = grids.map((g) => logSpecificAreaAt(g.values, area.bbox, 36));
      const held = grids.map((g) => {
        const n = g.rows;
        const routed = upslopeCells(g.values, "app", uniformRunoff(area.bbox, n, DESIGN_RUNOFF_MM), cellAreaOf(area.bbox, n));
        return routed.ponded / ((DESIGN_RUNOFF_MM / 1000) * cellAreaOf(area.bbox, n) * n * n);
      });
      const trappedV1 = grids.map((g) => interiorSinkCapture(g.values, "unconditioned").trappedShare);
      return {
        id: area.id,
        condition: area.condition,
        rho72: spearman(specific[0], specific[1]),
        rho120: spearman(specific[0], specific[2]),
        top120: topShareOverlap(specific[0], specific[2]),
        held,
        trappedV1,
      };
    });
    const med = (xs: number[]) => quantile(xs, 0.5);
    return {
      verdict: {
        status: "descriptive",
        statement: `Median rank correlation of flow concentration between low and high resolution is ${round(med(rows.map((r) => r.rho120)), 2)}; median top-10% hotspot overlap ${round(med(rows.map((r) => r.top120)), 2)}. With fill-and-spill a median ${round(med(rows.map((r) => r.held[2])) * 100, 0)}% of 50 mm design-storm runoff is held in depressions at high resolution; the original D8 stranded ${round(med(rows.map((r) => r.trappedV1[2])) * 100, 0)}% in pits.`,
      },
      findings: {
        areas: rows.length,
        medianRho36v72: round(med(rows.map((r) => r.rho72)), 3),
        medianRho36v120: round(med(rows.map((r) => r.rho120)), 3),
        medianTopOverlap36v120: round(med(rows.map((r) => r.top120)), 3),
        medianHeldShare36: round(med(rows.map((r) => r.held[0])), 3),
        medianHeldShare72: round(med(rows.map((r) => r.held[1])), 3),
        medianHeldShare120: round(med(rows.map((r) => r.held[2])), 3),
        medianTrappedShareV1_120: round(med(rows.map((r) => r.trappedV1[2])), 3),
      },
      observations: [
        `Lowest agreement: ${[...rows].sort((a, b) => a.rho120 - b.rho120)[0].id} (ρ ${round(Math.min(...rows.map((r) => r.rho120)), 2)}).`,
        "The original D8 (v1) stranded water in single-cell pits in proportion to how noisy the terrain is; fill-and-spill holds only what each depression's volume allows and passes the rest on.",
        "Hotspots that move between resolutions should not be read as stable locations: the colored zones are relative ranks within one run.",
      ],
      tables: [
        {
          title: "Per named area",
          columns: ["area", "condition", "ρ 36 v 72", "ρ 36 v 120", "top-10% overlap 36 v 120", "held 36", "held 72", "held 120", "v1 stranded 120"],
          rows: rows.map((r) => [r.id, r.condition, round(r.rho72, 3), round(r.rho120, 3), round(r.top120, 3), ...r.held.map((t) => round(t, 3)), round(r.trappedV1[2], 3)]),
        },
      ],
    };
  },
};

/* ------------------------------------------------ R3 DEM source */

export const demSourceSensitivity: Experiment = {
  spec: {
    id: "routing/R3-dem-source-sensitivity",
    domain: "routing",
    title: "Does routing change with the elevation source?",
    question: "On identical 72×72 grids, how similar are elevation, D8 directions and flow concentration from Terrarium tiles versus USGS 3DEP bare earth?",
    hypothesis: null,
    tier: "reference-dataset",
    inputs: ["areas.json", "dem/*.json"],
    conditions: { resolution: 72, areas: "8 named + first 40 seeded tiles (those with 3DEP)", forcing: `${DESIGN_RUNOFF_MM} mm runoff (50 mm storm, C 0.7)` },
    split: "None: descriptive sensitivity.",
    metrics: ["elevation RMSE and mean difference (m)", "share of cells with identical receiver", "Spearman of log accumulation", "top-10% hotspot overlap", "depression-held share per source"],
    limitations: ["Both sources derive partly from USGS elevation data; agreement is not independent confirmation.", "3DEP is resampled by the server and Terrarium by the app; part of the difference is resampling."],
  },
  run(load) {
    const rows = studyAreas(load).filter((area) => hasThreeDep(load, area.id)).map((area) => {
      const t = elevationFromFixture(load, area.id, "terrarium", 72);
      const d = elevationFromFixture(load, area.id, "3dep", 72);
      const dFlat = d.values.flat();
      const diffs = t.values.flat().map((v, i) => v - dFlat[i]);
      const forcing = uniformRunoff(area.bbox, 72, DESIGN_RUNOFF_MM);
      const cellArea = cellAreaOf(area.bbox, 72);
      const rt = upslopeCells(t.values, "app", forcing, cellArea);
      const rd = upslopeCells(d.values, "app", forcing, cellArea);
      let same = 0;
      for (let r = 0; r < 72; r += 1) for (let c = 0; c < 72; c += 1) {
        if (rt.receivers[r][c][0] === rd.receivers[r][c][0] && rt.receivers[r][c][1] === rd.receivers[r][c][1]) same += 1;
      }
      const lt = rt.accumulation.flat().map((v) => Math.log(Math.max(v, 1e-9)));
      const ld = rd.accumulation.flat().map((v) => Math.log(Math.max(v, 1e-9)));
      const total = forcing[0][0] * 72 * 72;
      return {
        id: area.id,
        minT: Math.min(...t.values.flat()),
        minD: Math.min(...d.values.flat()),
        rmse: Math.sqrt(mean(diffs.map((x) => x * x))),
        meanDiff: mean(diffs),
        sameReceiver: same / (72 * 72),
        rho: spearman(lt, ld),
        top: topShareOverlap(lt, ld),
        heldT: rt.ponded / total,
        heldD: rd.ponded / total,
      };
    });
    const med = (f: (r: (typeof rows)[number]) => number) => round(quantile(rows.map(f), 0.5), 3);
    return {
      verdict: {
        status: "descriptive",
        statement: `Across ${rows.length} areas, a median ${round(med((r) => r.sameReceiver) * 100, 0)}% of cells keep the same flow direction when the elevation source changes; elevations differ by a median RMSE of ${med((r) => r.rmse)} m and flow-concentration ranks correlate at median ρ ${med((r) => r.rho)}.`,
      },
      findings: {
        areas: rows.length,
        medianElevationRmseM: med((r) => r.rmse),
        medianMeanDifferenceM: med((r) => r.meanDiff),
        medianSameReceiverShare: med((r) => r.sameReceiver),
        medianRho: med((r) => r.rho),
        medianTopOverlap: med((r) => r.top),
        medianHeldTerrarium: med((r) => r.heldT),
        medianHeldThreeDep: med((r) => r.heldD),
        terrariumAreasBelowMinus50m: rows.filter((r) => r.minT < -50).length,
        threeDepAreasBelowMinus50m: rows.filter((r) => r.minD < -50).length,
        terrariumLowestM: round(Math.min(...rows.map((r) => r.minT)), 1),
        threeDepLowestM: round(Math.min(...rows.map((r) => r.minD)), 1),
      },
      observations: [
        `Terrarium minus 3DEP: median mean difference ${med((r) => r.meanDiff)} m.`,
        `Data quality: ${rows.filter((r) => r.minT < -50).length} of ${rows.length} Terrarium grids contain cells below −50 m (lowest ${round(Math.min(...rows.map((r) => r.minT)), 0)} m), against ${rows.filter((r) => r.minD < -50).length} for 3DEP (lowest ${round(Math.min(...rows.map((r) => r.minD)), 1)} m). NYC's deepest channels are a few tens of metres; values of hundreds or thousands of metres are artefacts. The app treats every cell at or below 0 m as receiving water (PREREGISTRATION.md, Addendum 3).`,
        `Design-storm runoff held in depressions: median ${round(med((r) => r.heldT) * 100, 0)}% on Terrarium, ${round(med((r) => r.heldD) * 100, 0)}% on 3DEP.`,
        "Small elevation differences flip flow directions because street-scale terrain is nearly flat: the steepest neighbour is often steeper by centimetres. Any single routed map should be read as one realisation of an uncertain surface.",
      ],
      tables: [
        {
          title: "Per area (72×72)",
          columns: ["area", "RMSE m", "mean diff m", "same receiver", "ρ log acc", "top-10% overlap", "held T", "held 3DEP"],
          rows: rows.map((r) => [r.id, round(r.rmse, 2), round(r.meanDiff, 2), round(r.sameReceiver, 3), round(r.rho, 3), round(r.top, 3), round(r.heldT, 3), round(r.heldD, 3)]),
        },
      ],
    };
  },
};

/* ------------------------------------------- R4/R5 311 association */

interface ComplaintPoint {
  key: string;
  created: string;
  descriptor: string;
  lat: number;
  lon: number;
}

function cellOf(area: StudyArea, n: number, lat: number, lon: number): [number, number] | null {
  const { bbox } = area;
  if (lat <= bbox.south || lat >= bbox.north || lon <= bbox.west || lon >= bbox.east) return null;
  return [Math.floor(((bbox.north - lat) / (bbox.north - bbox.south)) * n), Math.floor(((lon - bbox.west) / (bbox.east - bbox.west)) * n)];
}

function neighbourhoodMax(grid: number[][], radius: number): number[][] {
  if (radius === 0) return grid;
  const n = grid.length;
  return grid.map((row, r) =>
    row.map((_, c) => {
      let best = -Infinity;
      for (let dr = -radius; dr <= radius; dr += 1) for (let dc = -radius; dc <= radius; dc += 1) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) best = Math.max(best, grid[rr][cc]);
      }
      return best;
    }),
  );
}

/**
 * Event rainfall from the Central Park gauge: calendar days covered by the
 * window, excluding an end date whose window closes at 00:00
 * (PREREGISTRATION.md, Addendum 2).
 */
export function eventRainfallMm(event: ValidationEvent, gauge: Array<{ date: string; prcpMm: number }>): number {
  const first = event.start.slice(0, 10);
  const last = event.end.slice(0, 10);
  const includeLast = !event.end.endsWith("T00:00:00");
  return gauge.filter((d) => d.date >= first && (d.date < last || (includeLast && d.date === last))).reduce((s, d) => s + d.prcpMm, 0);
}

/** NLCD composition mapped onto model classes: water, impervious → pavement, pervious → vegetation. */
export function nlcdCover(grid: NlcdGrid): LandCover {
  const ref = nlcdReference(grid);
  return { water: ref.water, pavement: ref.impervious, vegetation: ref.pervious, buildings: 0, soil: 0 };
}

type Predictor = "accumulation" | "lowness" | "ponding";

export interface AssociationOptions {
  descriptors: string[];
  radius: number;
  dem: "terrarium" | "3dep";
  variant: RoutingVariant;
}

/** Per-area percentiles of complaint cells for each predictor, clustered by area. */
export function complaintPercentiles(load: FixtureLoader, events: ValidationEvent[], options: AssociationOptions) {
  const areas = studyAreas(load).filter((area) => options.dem === "terrarium" || hasThreeDep(load, area.id));
  const gauge = load<Array<{ date: string; prcpMm: number }>>("rain-central-park.json").data;
  const nlcd = load<Record<string, NlcdGrid>>("nlcd-2021.json").data;
  const predictors: Predictor[] = options.variant === "app" ? ["accumulation", "lowness", "ponding"] : ["accumulation", "lowness"];
  const clusters = Object.fromEntries(predictors.map((p) => [p, [] as number[][]])) as Record<Predictor, number[][]>;
  let complaints = 0;
  let areasWithComplaints = 0;
  for (const area of areas) {
    const grid = elevationFromFixture(load, area.id, options.dem, 72);
    const c = runoffCoefficient(nlcdCover(nlcd[area.id]));
    const percentiles = Object.fromEntries(predictors.map((p) => [p, [] as number[]])) as Record<Predictor, number[]>;
    const seen = new Set<string>();
    for (const event of events) {
      const points = load<{ points: ComplaintPoint[] }>(`311/${event.id}.json`).data.points.filter((p) => options.descriptors.includes(p.descriptor));
      const cellsHit: Array<[number, number]> = [];
      for (const p of points) {
        const cell = cellOf(area, 72, p.lat, p.lon);
        const key = `${event.id}:${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
        if (!cell || seen.has(key)) continue;
        seen.add(key);
        cellsHit.push(cell);
      }
      if (cellsHit.length === 0) continue;
      const routed = upslopeCells(grid.values, options.variant, uniformRunoff(area.bbox, 72, eventRainfallMm(event, gauge) * c), cellAreaOf(area.bbox, 72));
      const grids: Partial<Record<Predictor, number[][]>> = {
        accumulation: neighbourhoodMax(routed.accumulation, options.radius),
        lowness: neighbourhoodMax(grid.values.map((row) => row.map((v) => -v)), options.radius),
        ...(routed.pondDepthM ? { ponding: neighbourhoodMax(routed.pondDepthM, options.radius) } : {}),
      };
      for (const predictor of predictors) {
        const flat = grids[predictor]!.flat();
        for (const [r, col] of cellsHit) percentiles[predictor].push(midRankPercentile(grids[predictor]![r][col], flat));
      }
    }
    if (percentiles.accumulation.length) areasWithComplaints += 1;
    complaints += percentiles.accumulation.length;
    for (const predictor of predictors) clusters[predictor].push(percentiles[predictor]);
  }
  const auc = (predictor: Predictor) => clusterBootstrap(clusters[predictor], (xs) => (xs.length ? mean(xs) : 0.5));
  const versusLowness = (predictor: Predictor) =>
    clusterBootstrap(
      clusters[predictor].map((values, i) => values.map((v, j) => v - clusters.lowness[i][j])),
      (xs) => (xs.length ? mean(xs) : 0),
    );
  return {
    complaints,
    areasWithComplaints,
    areas: areas.length,
    accumulation: auc("accumulation"),
    lowness: auc("lowness"),
    difference: versusLowness("accumulation"),
    ponding: clusters.ponding ? auc("ponding") : null,
    pondingDifference: clusters.ponding ? versusLowness("ponding") : null,
  };
}

function associationExperiment(role: ValidationEvent["role"], id: string): Experiment {
  const events = EVENTS.filter((e) => e.role === role);
  return {
    spec: {
      id,
      domain: "routing",
      title: role === "holdout" ? "Holdout: routed accumulation and reported street flooding" : "Development: routed accumulation and reported street flooding",
      question: "Do cells where people reported street flooding rank higher in routed flow accumulation than other cells of the same study area — and higher than simple low-elevation ranking?",
      hypothesis: "Pooled AUC of routed accumulation exceeds 0.5 and exceeds the low-elevation baseline, with the 95% cluster-bootstrap interval of the difference excluding zero.",
      tier: "independent-observation",
      inputs: ["areas.json", "dem/*.json", "nlcd-2021.json", "rain-central-park.json", ...events.map((e) => `311/${e.id}.json`)],
      conditions: {
        events: events.map((e) => e.id).join(","),
        role,
        descriptor: PRIMARY_DESCRIPTOR,
        matchingRadiusCells: 0,
        resolution: 72,
        dem: "terrarium",
        routing: "app model (v2 fill-and-spill); v1 D8 reported as secondary",
        forcing: "Central Park gauge event rainfall × NLCD-derived runoff coefficient per area",
      },
      split: role === "holdout"
        ? "Holdout event fixed in experiments/PREREGISTRATION.md; evaluated once, after development-stage revisions were frozen (Addenda 1–2)."
        : "Development events fixed in experiments/PREREGISTRATION.md; they informed diagnosis. The routing revision was adopted on the analytic R1 criterion, not on these results. The holdout is not read by this experiment.",
      metrics: ["AUC (mean within-area mid-rank percentile of complaint cells)", "low-elevation baseline AUC", "paired difference with 95% cluster-bootstrap interval (areas resampled)", "secondary: static ponded depth AUC"],
      limitations: [
        "311 complaints are reports, not measurements; absence of a report is not a dry observation.",
        "Reporting depends on population, traffic and awareness, which also correlate with terrain.",
        "Complaint coordinates are geocoded addresses, typically tens of metres from the flooded spot; cells are about 14 m.",
        "One rain gauge stands for the whole city; event rainfall varied strongly across boroughs.",
        "No sewer network is modelled, while NYC street flooding is largely sewer-capacity driven.",
        "Land cover is uniform within each area, so spatial patterns come from terrain; the classifier is not tested here.",
      ],
    },
    run(load) {
      const options = { descriptors: [PRIMARY_DESCRIPTOR], radius: 0, dem: "terrarium" as const, variant: "app" as const };
      const primary = complaintPercentiles(load, events, options);
      const sensitivity = [
        { label: "original D8 (v1)", options: { ...options, variant: "unconditioned" as const } },
        { label: "street + catch basin", options: { ...options, descriptors: [PRIMARY_DESCRIPTOR, "Catch Basin Clogged/Flooding (Use Comments) (SC)"] } },
        { label: "1-cell neighbourhood", options: { ...options, radius: 1 } },
        { label: "3DEP elevation (48 areas)", options: { ...options, dem: "3dep" as const } },
      ].map((s) => ({ label: s.label, result: complaintPercentiles(load, events, s.options) }));
      const beatsChance = primary.accumulation.lower > 0.5;
      const beatsBaseline = primary.difference.lower > 0;
      const status = primary.complaints < 20 ? "inconclusive" : beatsChance && beatsBaseline ? "supported" : primary.accumulation.upper < 0.5 || primary.difference.upper < 0 ? "not-supported" : "inconclusive";
      const fmt = (b: { estimate: number; lower: number; upper: number } | null) => (b ? `${round(b.estimate, 3)} [${round(b.lower, 3)}, ${round(b.upper, 3)}]` : "—");
      const table: ResultTable = {
        title: "AUC with 95% cluster-bootstrap intervals",
        columns: ["variant", "reports", "areas with reports", "accumulation AUC", "low-elevation AUC", "accumulation − low elevation", "ponded depth AUC", "ponded − low elevation"],
        rows: [
          ["primary (app v2)", primary.complaints, primary.areasWithComplaints, fmt(primary.accumulation), fmt(primary.lowness), fmt(primary.difference), fmt(primary.ponding), fmt(primary.pondingDifference)],
          ...sensitivity.map(({ label, result }) => [label, result.complaints, result.areasWithComplaints, fmt(result.accumulation), fmt(result.lowness), fmt(result.difference), fmt(result.ponding), fmt(result.pondingDifference)]),
        ],
      };
      const v1 = sensitivity[0].result;
      return {
        verdict: {
          status,
          statement: `Across ${primary.complaints} deduplicated street-flooding reports in ${primary.areasWithComplaints} of ${primary.areas} areas, routed accumulation AUC is ${fmt(primary.accumulation)} versus ${fmt(primary.lowness)} for simple low elevation (difference ${fmt(primary.difference)}). ${status === "supported" ? "Accumulation carries information beyond low elevation, within these limits." : status === "not-supported" ? "Routed accumulation does not locate reports better than the low-elevation baseline." : "The evidence does not separate routed accumulation from the baseline."}`,
        },
        findings: {
          complaints: primary.complaints,
          areasWithComplaints: primary.areasWithComplaints,
          aucAccumulation: round(primary.accumulation.estimate, 3),
          aucAccumulationLower: round(primary.accumulation.lower, 3),
          aucAccumulationUpper: round(primary.accumulation.upper, 3),
          aucLowElevation: round(primary.lowness.estimate, 3),
          aucDifference: round(primary.difference.estimate, 3),
          aucDifferenceLower: round(primary.difference.lower, 3),
          aucDifferenceUpper: round(primary.difference.upper, 3),
          aucPonding: primary.ponding ? round(primary.ponding.estimate, 3) : null,
          aucPondingDifference: primary.pondingDifference ? round(primary.pondingDifference.estimate, 3) : null,
          aucPondingDifferenceLower: primary.pondingDifference ? round(primary.pondingDifference.lower, 3) : null,
          aucPondingDifferenceUpper: primary.pondingDifference ? round(primary.pondingDifference.upper, 3) : null,
          aucAccumulationV1: round(v1.accumulation.estimate, 3),
          ...Object.fromEntries(sensitivity.slice(1).map(({ label, result }) => [`auc_${label.replace(/[^a-z0-9]+/gi, "_").replace(/_+$/, "")}`, round(result.accumulation.estimate, 3)])),
        },
        observations: [
          `Of ${primary.areas} study areas, ${primary.areasWithComplaints} contain at least one street-flooding report in the ${role} window(s).`,
          `Original D8 (v1) accumulation AUC ${fmt(v1.accumulation)}; app v2 ${fmt(primary.accumulation)}.`,
          `Secondary (declared in Addendum 2): static ponded depth AUC ${fmt(primary.ponding)}, difference from low elevation ${fmt(primary.pondingDifference)}. Most cells have zero ponding, so this AUC is dominated by ties.`,
          ...sensitivity.slice(1).map(({ label, result }) => `Sensitivity (${label}): accumulation AUC ${fmt(result.accumulation)}, low-elevation ${fmt(result.lowness)}.`),
        ],
        tables: [table],
      };
    },
  };
}

export const complaintAssociationDevelopment = associationExperiment("development", "routing/R4-311-association-development");
/** Registered only after the model was frozen at commit a534af4 (PREREGISTRATION.md). */
export const complaintAssociationHoldout = associationExperiment("holdout", "routing/R5-311-association-holdout");
export { associationExperiment };
