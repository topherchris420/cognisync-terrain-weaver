import { describe, expect, it } from "vitest";
import { buildExperimentExport } from "./experiment-export";
import { replayExperiment } from "./experiment-replay";
import { EXAMPLE_ANALYSIS } from "./example-analysis";
import { EMPTY_SCENARIO } from "./scenario";
import { createStormSeal } from "./storm-identity";
import { stableHash } from "./counterfactual/hashing";
import { rasterizeSurfaceModifiers } from "./counterfactual/modifiers";
import { routeWatershed, syntheticElevation } from "./hydrology";
import { squareIntervention } from "./validation/fixtures";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const forcing = { rainfallDepthMm: 50, durationMinutes: 60, distribution: "uniform" as const, resolution: "low" as const, includeDrainage: false as const };
const storm = createStormSeal({ ...forcing, id: "replay-storm", hash: stableHash(forcing) }, "2026-09-29T00:00:00.000Z");
const elevation = syntheticElevation(bbox, 36, 36);
const swale = squareIntervention("bioswales", bbox, 4000);
const base = { ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: storm.storm.hash, elevation };
const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "surface:now" });
const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([swale], bbox, 36, 36), expectedElevationHash: now.elevationHash });

function exportJson() {
  const evidence = buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [swale], storm, now, possible, extent: bbox, elevation });
  // Round-trip through text, as a researcher receiving the file would.
  return JSON.parse(JSON.stringify(evidence));
}

describe("experiment export v2", () => {
  it("records controlled variables, evidence status and reproducibility", () => {
    const evidence = exportJson();
    expect(evidence.schema).toBe("mannahatta-experiment-v2");
    expect(evidence.comparison.controlled.valid).toBe(true);
    expect(evidence.values.landCover.status).toBe("illustrative");
    expect(evidence.values.retentionWeights.status).toBe("assumed");
    expect(evidence.values.possibleResult.status).toBe("counterfactual");
    expect(evidence.reproducibility.replayable).toBe(true);
    expect(evidence.validationEvidence.find((e: { component: string }) => e.component === "Routed accumulation zones").validation).toBe("failed");
  });

  it("refuses an embedded grid that is not the routed one", () => {
    expect(() => buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [swale], storm, now, possible, extent: bbox, elevation: syntheticElevation({ ...bbox, north: 40.713 }, 36, 36) })).toThrow(/Embedded elevation/);
  });
});

describe("replay", () => {
  it("reproduces an exported NOW/POSSIBLE pair exactly", () => {
    const report = replayExperiment(exportJson());
    expect(report.checks.filter((c) => !c.passed)).toEqual([]);
    expect(report.reproduced).toBe(true);
  });

  it("detects a tampered result", () => {
    const evidence = exportJson();
    evidence.results.possible.metadata.runoff_volume_m3 -= 100;
    const report = replayExperiment(evidence);
    expect(report.reproduced).toBe(false);
    expect(report.checks.find((c) => c.id === "evidence-hash")?.passed).toBe(false);
  });

  it("detects a tampered elevation grid even when the hash field is updated to match", () => {
    const evidence = exportJson();
    evidence.inputs.elevation.values[3][3] += 5;
    evidence.inputs.elevation.hash = stableHash(evidence.inputs.elevation.values);
    const { evidenceHash: _unused, ...rest } = evidence;
    evidence.evidenceHash = stableHash(rest);
    const report = replayExperiment(evidence);
    expect(report.checks.find((c) => c.id === "elevation-hash")?.passed).toBe(false);
  });

  it("says plainly when an export cannot be replayed", () => {
    const evidence = JSON.parse(JSON.stringify(buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [], storm: null, now: null, possible: null })));
    const report = replayExperiment(evidence);
    expect(report.reproduced).toBe(false);
    expect(report.checks.find((c) => c.id === "inputs-present")?.passed).toBe(false);
  });
});
