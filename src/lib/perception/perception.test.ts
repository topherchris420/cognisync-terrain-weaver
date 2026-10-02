import { describe, expect, it, vi } from "vitest";
import { stableHash } from "@/lib/counterfactual/hashing";
import { boundlessSceneAdapter, compositionFromHistogram, histogramFromPalette, BOUNDLESS_CLASSES, type BoundlessSceneRecord } from "./boundless-adapter";
import { evaluateSyntheticBenchmark, runSyntheticBenchmark, type BenchmarkPrediction } from "./benchmark";
import { NOT_REAL_WORLD, SYNTHETIC_LABEL, type ImageSource, type SyntheticScene } from "./synthetic-scene";

// Every number below is a hand-made test input, not a measured result.
const SHA = "a".repeat(64);

function record(overrides: Partial<BoundlessSceneRecord> = {}): BoundlessSceneRecord {
  return {
    id: "scene-1",
    rgbPath: "rgb/scene-1.png",
    rgbSha256: SHA,
    semanticHistogram: { building: 400, road: 300, grass: 200, water: 100, sky: 500, car: 500 },
    camera: { view: "nadir", pitchDeg: -90, altitudeM: 300 },
    pedestrians: "procedural",
    lighting: "noon",
    ...overrides,
  };
}

describe("BoundlessNYC adapter", () => {
  it("maps semantic classes to Mannahatta's five and reports what it excluded", () => {
    const { composition, unmappedShare, ambiguousShare } = compositionFromHistogram({ building: 40, roof_structure: 10, road: 30, terrain: 10, water: 10, sky: 50, pedestrian: 50 });
    expect(composition).toEqual({ vegetation: 0, pavement: 30, buildings: 50, bareSoil: 10, water: 10 });
    expect(unmappedShare).toBe(0.5);
    expect(ambiguousShare).toBeCloseTo(0.1, 12);
    expect(() => compositionFromHistogram({ dragon: 4 })).toThrow(/Unknown BoundlessNYC class/);
    expect(() => compositionFromHistogram({ sky: 10 })).toThrow(/No land-cover pixels/);
  });

  it("reads colourised masks by palette, treating unknown colours as unlabeled", () => {
    const road = BOUNDLESS_CLASSES.find((c) => c.name === "road")!.rgb;
    const water = BOUNDLESS_CLASSES.find((c) => c.name === "water")!.rgb;
    expect(histogramFromPalette(new Uint8Array([...road, ...road, ...water, 1, 2, 3]), 3)).toEqual({ road: 2, water: 1, unlabeled: 1 });
  });

  it("refuses scenes rendered with MetaHuman-derived or unknown pedestrians", () => {
    expect(() => boundlessSceneAdapter.toScene(record({ pedestrians: "metahuman" }))).toThrow(/may not be used to test AI models/);
    expect(() => boundlessSceneAdapter.toScene(record({ pedestrians: "unknown" }))).toThrow(/procedural/);
    const scene = boundlessSceneAdapter.toScene(record({ vehiclesPresent: true }));
    expect(scene.metadata.attribution).toContain("© OpenStreetMap contributors");
    expect(scene.metadata.attribution?.some((a) => a.includes("CARLA"))).toBe(true);
    expect(boundlessSceneAdapter.toScene(record()).metadata.attribution?.some((a) => a.includes("CARLA"))).toBe(false);
    expect(() => boundlessSceneAdapter.toScene(record({ rgbSha256: "nope" }))).toThrow(/SHA-256/);
    // Absent optional fields are omitted, so scenes can always be hashed canonically.
    expect(() => stableHash(boundlessSceneAdapter.toScene(record({ lighting: undefined })))).not.toThrow();
  });
});

describe("synthetic diagnostic benchmark", () => {
  const scene = (id: string, view: "nadir" | "oblique" = "nadir", lighting = "noon"): SyntheticScene => ({
    id,
    rgb: { kind: "path", value: `rgb/${id}.png`, sha256: SHA },
    groundTruth: { vegetation: 30, pavement: 40, buildings: 20, bareSoil: 0, water: 10 },
    metadata: { source: "test", camera: { view }, lighting },
  });
  const prediction = (sceneId: string, repeat: number, vegetation: number, pavement: number): BenchmarkPrediction => ({
    sceneId,
    rgbSha256: SHA,
    repeat,
    landCover: { vegetation, pavement, buildings: 20, soil: 0, water: 10 },
    model: "test",
    classifiedAt: "2026-10-02T00:00:00.000Z",
  });

  it("sends the classifier the RGB image and nothing else", async () => {
    const classify = vi.fn(async (_rgb: ImageSource) => ({ landCover: { vegetation: 30, pavement: 40, buildings: 20, soil: 0, water: 10 }, model: "test" }));
    const predictions = await runSyntheticBenchmark([scene("a")], classify, { repeats: 2, now: () => "t" });
    expect(classify).toHaveBeenCalledTimes(2);
    expect(Object.keys(classify.mock.calls[0][0]).sort()).toEqual(["kind", "sha256", "value"]);
    expect(JSON.stringify(classify.mock.calls[0])).not.toMatch(/groundTruth|lighting|vegetation/);
    expect(predictions.map((p) => p.repeat)).toEqual([0, 1]);
  });

  it("scores composition error, pervious error, transfer trends, repeat spread and conditions", () => {
    const scenes = [scene("a"), scene("b", "nadir", "dusk"), scene("c", "oblique")];
    const predictions = [prediction("a", 0, 20, 50), prediction("a", 1, 24, 46), prediction("b", 0, 30, 40)];
    const result = evaluateSyntheticBenchmark(scenes, predictions);
    expect(result.label).toBe(SYNTHETIC_LABEL);
    expect(result.caveat).toBe(NOT_REAL_WORLD);
    expect(result.scenes).toBe(2);
    expect(result.excludedScenes).toEqual([{ sceneId: "c", reason: "not a nadir view" }]);
    // Scene a: mean vegetation 22 (−8), pavement 48 (+8); scene b exact.
    expect(result.perClassMaePP?.vegetation).toBe(4);
    expect(result.perClassBiasPP?.pavement).toBe(4);
    expect(result.perviousShareMaePP).toBe(4);
    expect(result.totalCompositionErrorPP).toBe(4);
    expect(result.estimatedTransferPP?.vegetation.pavement).toBe(4);
    expect(result.estimatedTransferPP?.pavement.vegetation).toBe(0);
    expect(result.maxRepeatRangePP).toBe(4);
    expect(result.byCondition.find((c) => c.value === "dusk")?.totalCompositionErrorPP).toBe(0);
  });

  it("reports nothing rather than invent numbers when no scene has a prediction", () => {
    const result = evaluateSyntheticBenchmark([scene("a")], []);
    expect(result.scenes).toBe(0);
    expect(result.perviousShareMaePP).toBeNull();
    expect(result.excludedScenes).toEqual([{ sceneId: "a", reason: "no prediction" }]);
  });

  it("refuses a prediction made on a different image", () => {
    expect(() => evaluateSyntheticBenchmark([scene("a")], [{ ...prediction("a", 0, 30, 40), rgbSha256: "b".repeat(64) }])).toThrow(/different image/);
  });
});
