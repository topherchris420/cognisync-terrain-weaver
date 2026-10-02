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
import { controlledComparison } from "./counterfactual/controlled";
import { compileSubstrate } from "./urban-substrate/compiler";
import { serializeManifest } from "./urban-substrate/manifest";
import { coverageBBox } from "./urban-substrate/regions";
import { TEST_CONFIG, testSources } from "./urban-substrate/test-fixtures";
import { loadSubstrateView, memoryStore } from "./urban-substrate/loader";
import { substrateEvidence } from "./urban-substrate/evidence";
import type { SubstrateReader } from "./urban-substrate/replay";

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

describe("experiment export v3", () => {
  it("records controlled variables, evidence status and reproducibility", () => {
    const evidence = exportJson();
    expect(evidence.schema).toBe("mannahatta-experiment-v3");
    expect(evidence.provenance.substrate).toBe("not-consulted");
    expect(evidence.comparison.controlled.fixed.find((v: { id: string }) => v.id === "substrate_hash").identical).toBe(true);
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

describe("replay with an urban substrate", () => {
  const compiled = compileSubstrate(testSources(), TEST_CONFIG, { generatedAt: "2026-10-01T00:00:00.000Z", commit: null });
  const manifestText = serializeManifest(compiled.manifest);
  const reader = (overrides: Record<string, string | null> = {}): SubstrateReader => ({
    location: "memory",
    manifest: () => manifestText,
    tile: (id) => (id in overrides ? overrides[id] : compiled.texts.get(id) ?? null),
  });
  const [w, s] = coverageBBox(TEST_CONFIG);
  const studyBox = { west: w + 0.001, south: s + 0.001, east: w + 0.008, north: s + 0.006 };

  async function substrateExport() {
    const view = await loadSubstrateView(memoryStore({ texts: compiled.texts, manifestText }), studyBox);
    const routed = { ...base, bbox: studyBox, elevation: syntheticElevation(studyBox, 36, 36), substrateHash: view.identity.identityHash };
    const pairNow = routeWatershed({ ...routed, surfaceId: "now", surfaceHash: "surface:now" });
    const pairPossible = routeWatershed({ ...routed, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([squareIntervention("bioswales", studyBox, 4000)], studyBox, 36, 36), expectedElevationHash: pairNow.elevationHash });
    const evidence = buildExperimentExport({
      analysis: EXAMPLE_ANALYSIS,
      scenario: EMPTY_SCENARIO,
      interventions: [squareIntervention("bioswales", studyBox, 4000)],
      storm,
      now: pairNow,
      possible: pairPossible,
      extent: studyBox,
      elevation: routed.elevation,
      substrate: substrateEvidence(view.identity, view),
    });
    return { view, json: JSON.parse(JSON.stringify(evidence)) };
  }

  it("records the substrate identity and reconstructs every recorded tile", async () => {
    const { view, json } = await substrateExport();
    expect(json.substrate.state.tileIds).toEqual(view.identity.tileIds);
    expect(json.results.now.metadata.substrate_hash).toBe(view.identity.identityHash);
    const report = replayExperiment(json, { substrate: reader() });
    expect(report.checks.filter((c) => !c.passed)).toEqual([]);
    expect(report.reproduced).toBe(true);
  });

  it("fails replay when a recorded tile is altered, missing, or no store is given", async () => {
    const { view, json } = await substrateExport();
    const tile = view.identity.tileIds.find((id) => id.includes("/512/"))!;
    const altered = replayExperiment(json, { substrate: reader({ [tile]: compiled.texts.get(tile)!.replace('"crs":"EPSG:4326"', '"crs":"EPSG:3857"') }) });
    expect(altered.reproduced).toBe(false);
    expect(altered.substrateMismatches).toContainEqual(expect.objectContaining({ kind: "tile-hash", tileId: tile }));
    expect(replayExperiment(json, { substrate: reader({ [tile]: null }) }).substrateMismatches[0].kind).toBe("missing-tile");
    expect(replayExperiment(json).reproduced).toBe(false);
  });

  it("refuses to pair runs made on different substrates", async () => {
    const { view } = await substrateExport();
    const other = { ...possible, metadata: { ...possible.metadata, substrate_hash: view.identity.identityHash } };
    expect(controlledComparison(now, other).violations.join(" ")).toMatch(/Urban substrate/);
    expect(() => buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [swale], storm, now, possible: other, extent: bbox, elevation })).toThrow(/urban substrate identity/);
    // A run claiming a substrate the export does not describe is refused too.
    const claimed = { ...now, metadata: { ...now.metadata, substrate_hash: view.identity.identityHash } };
    expect(() => buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [], storm, now: claimed, possible: null, extent: bbox, elevation })).toThrow(/does not describe/);
  });

  it("still replays an export made before substrate identity existed", () => {
    const evidence = exportJson();
    delete evidence.substrate;
    delete evidence.results.now.metadata.substrate_hash;
    delete evidence.results.possible.metadata.substrate_hash;
    const { evidenceHash: _unused, ...rest } = evidence;
    evidence.evidenceHash = stableHash(rest);
    const report = replayExperiment(evidence);
    expect(report.checks.find((c) => c.id === "substrate")?.detail).toMatch(/not recorded/);
    expect(report.reproduced).toBe(true);
  });
});
