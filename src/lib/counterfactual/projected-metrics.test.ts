import { describe, expect, it } from "vitest";
import { assessScenario, DEFAULT_ASSUMPTIONS } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";
import type { InterventionFeature } from "./types";
import {
  deriveScenarioFromFeatures,
  projectEditMetrics,
} from "./projected-metrics";

const cover: LandCover = {
  pavement: 40,
  buildings: 30,
  vegetation: 20,
  soil: 10,
  water: 0,
};
const geometry: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [0, 0],
    [0.001, 0],
    [0.001, 0.001],
    [0, 0.001],
    [0, 0],
  ]],
};

function makeFeature(
  id: string,
  type: InterventionFeature["type"],
  validAreaM2: number
): InterventionFeature {
  return {
    id,
    type,
    geometry,
    areaM2: validAreaM2,
    parameters: {
      retentionFractionDelta: 0.5,
      storageDeltaMm: 0,
      roughnessDelta: 0,
      calibrationProvenance: [],
    },
    eligibility: {
      eligible: true,
      validGeometry: geometry,
      invalidGeometry: null,
      validAreaM2,
      invalidAreaM2: 0,
      reasonCodes: [],
      confidence: "high",
      provenance: [],
      caveats: [],
    },
    provenance: [],
  };
}

describe("immediate edit projection", () => {
  const features = [
    makeFeature("roof", "green_roofs", 1_500),
    makeFeature("paving", "permeable_pavement", 1_000),
  ];

  it("uses the preserved scenario economics", () => {
    const metrics = projectEditMetrics({
      features,
      cover,
      siteAreaM2: 10_000,
      rainfallMm: 50,
      gridShape: { rows: 180, cols: 180 },
    });
    const scenario = deriveScenarioFromFeatures(
      features,
      cover,
      10_000
    );

    expect(metrics.scenarioImpact).toEqual(
      assessScenario(
        cover,
        scenario,
        10_000,
        { ...DEFAULT_ASSUMPTIONS, annualRainfallMm: 50 }
      )
    );
    expect(metrics.status).toBe("estimated until storm rerun");
    expect(metrics.estimatedRunoffM3).toBeGreaterThanOrEqual(0);
    expect(metrics.warnings).toContainEqual(expect.stringMatching(/storage/i));
    expect(metrics.warnings).toContainEqual(expect.stringMatching(/roughness/i));
  });

  it("normalizes competing edits against the preserved source shares", () => {
    const scenario = deriveScenarioFromFeatures(
      [
        makeFeature("trees", "street_trees", 4_000),
        makeFeature("swales", "bioswales", 4_000),
      ],
      cover,
      10_000
    );

    expect(scenario.street_trees + scenario.bioswales).toBeCloseTo(1);
  });

  it("counts overlapping geometry only once in scenario economics", () => {
    const one = deriveScenarioFromFeatures(
      [makeFeature("one", "bioswales", 12_000)],
      cover,
      1_000_000
    );
    const duplicated = deriveScenarioFromFeatures(
      [
        makeFeature("one", "bioswales", 12_000),
        makeFeature("two", "bioswales", 12_000),
      ],
      cover,
      1_000_000
    );

    expect(duplicated.bioswales).toBeCloseTo(one.bioswales);
  });

  it("hashes valid geometry deterministically and recognizes a matching rerun", () => {
    const first = projectEditMetrics({
      features,
      cover,
      siteAreaM2: 10_000,
      rainfallMm: 50,
      gridShape: { rows: 180, cols: 180 },
    });
    const reordered = projectEditMetrics({
      features: [...features].reverse(),
      cover,
      siteAreaM2: 10_000,
      rainfallMm: 50,
      gridShape: { rows: 180, cols: 180 },
      modeledSurfaceHash: first.surfaceHash,
    });

    expect(reordered.surfaceHash).toBe(first.surfaceHash);
    expect(reordered.status).toBe("modeled");
  });

  it("does not make ephemeral editor IDs part of physical surface identity", () => {
    const first = projectEditMetrics({
      features,
      cover,
      siteAreaM2: 10_000,
      rainfallMm: 50,
      gridShape: { rows: 180, cols: 180 },
    });
    const recreated = projectEditMetrics({
      features: features.map((feature, index) => ({
        ...feature,
        id: `recreated-${index}`,
      })),
      cover,
      siteAreaM2: 10_000,
      rainfallMm: 50,
      gridShape: { rows: 180, cols: 180 },
    });

    expect(recreated.surfaceHash).toBe(first.surfaceHash);
  });
});
