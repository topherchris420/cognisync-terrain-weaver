import { expect, it } from "vitest";
import { buildExperimentExport } from "./experiment-export";
import { EXAMPLE_ANALYSIS } from "./example-analysis";
import { EMPTY_SCENARIO } from "./scenario";
const input = { analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [], storm: null, now: null, possible: null };
it("exports stable evidence identity and preserves example provenance", () => {
  const a = buildExperimentExport(input);
  expect(a.evidenceHash).toBe(buildExperimentExport(input).evidenceHash);
  expect(a.provenance.landCover).toBe("illustrative");
  expect(buildExperimentExport({ ...input, scenario: { ...EMPTY_SCENARIO, street_trees: .2 } }).evidenceHash).not.toBe(a.evidenceHash);
});
it("refuses routed data without a sealed experiment", () => {
  expect(() => buildExperimentExport({ ...input, now: { flow_paths: [], risk_zones: [], impact_points: [], metadata: { processed_area_km2: 1, cells_analyzed: 100, computation_time_ms: 0 } } })).toThrow(/storm identity/);
});

it("carries real engine identities and rejects a changed forcing or terrain", async () => {
  const { runLocalStorm, syntheticElevation } = await import("./hydrology");
  const { createStormSeal } = await import("./storm-identity");
  const { stableHash } = await import("./counterfactual/hashing");
  const forcing = { rainfallDepthMm: 50, durationMinutes: 60, distribution: "uniform" as const, resolution: "low" as const, includeDrainage: false as const };
  const storm = createStormSeal({ ...forcing, id: "test-storm", hash: stableHash(forcing) });
  const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
  const now = await runLocalStorm({ ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, surfaceId: "now", surfaceHash: "test-now", stormHash: storm.storm.hash, elevation: syntheticElevation(bbox, 36, 36) });
  const possible = { ...now, metadata: { ...now.metadata, surface_id: "possible" as const, surface_hash: "test-possible" } };
  const evidence = buildExperimentExport({ ...input, storm, now, possible });
  expect(evidence.results.now?.metadata.storm_hash).toBe(storm.storm.hash);
  expect(evidence.provenance.elevation).toBe("illustrative");
  expect(() => buildExperimentExport({ ...input, storm, now, possible: { ...possible, metadata: { ...possible.metadata, elevation_hash: "other" } } })).toThrow(/terrain identities/);
  expect(() => buildExperimentExport({ ...input, storm, now: { ...now, metadata: { ...now.metadata, storm_hash: "other" } } })).toThrow(/sealed storm/);
});
