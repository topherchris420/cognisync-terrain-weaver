import { describe, expect, it } from "vitest";
import { buildExperimentExport } from "./experiment-export";
import { fetchSubstrateReader, importExperiment, parseExperimentFile, readFileText } from "./experiment-import";
import { EXAMPLE_ANALYSIS } from "./example-analysis";
import { EMPTY_SCENARIO } from "./scenario";
import { createStormSeal } from "./storm-identity";
import { stableHash } from "./counterfactual/hashing";
import { rasterizeSurfaceModifiers } from "./counterfactual/modifiers";
import { routeWatershed, syntheticElevation } from "./hydrology";
import { squareIntervention } from "./validation/fixtures";
import { compileSubstrate } from "./urban-substrate/compiler";
import { serializeManifest, tilePath } from "./urban-substrate/manifest";
import { coverageBBox } from "./urban-substrate/regions";
import { TEST_CONFIG, testSources } from "./urban-substrate/test-fixtures";
import { loadSubstrateView, memoryStore } from "./urban-substrate/loader";
import { substrateEvidence } from "./urban-substrate/evidence";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const forcing = { rainfallDepthMm: 50, durationMinutes: 60, distribution: "uniform" as const, resolution: "low" as const, includeDrainage: false as const };
const storm = createStormSeal({ ...forcing, id: "import-storm", hash: stableHash(forcing) }, "2026-10-12T00:00:00.000Z");
const elevation = syntheticElevation(bbox, 36, 36);
const swale = squareIntervention("bioswales", bbox, 4000);
const base = { ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: storm.storm.hash, elevation };
const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "surface:now" });
const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([swale], bbox, 36, 36), expectedElevationHash: now.elevationHash });
const scenario = { ...EMPTY_SCENARIO, bioswales: 0.12 };

const exportText = () =>
  JSON.stringify(buildExperimentExport({ analysis: { ...EXAMPLE_ANALYSIS, absorption_score: 99, status: "complete" }, scenario, interventions: [swale], storm, now, possible, extent: bbox, elevation }), null, 2);

describe("reopening an experiment export", () => {
  it("verifies, replays and rebuilds the study from inputs only", async () => {
    const study = await importExperiment(exportText());
    expect(study.report.reproduced).toBe(true);
    expect(study.report.checks.find((c) => c.id === "spatial-difference")?.passed).toBe(true);
    // The score is recomputed from land cover, never trusted from the file (the file said 99).
    expect(study.analysis.absorption_score).toBe(EXAMPLE_ANALYSIS.absorption_score);
    expect(study.analysis.status).toBe("complete");
    expect(study.analysis.bbox).toEqual(EXAMPLE_ANALYSIS.bbox);
    expect(study.analysis.center_lat).toBeCloseTo(40.7075, 4);
    expect(study.scenario.bioswales).toBe(0.12);
    expect(study.interventions).toHaveLength(1);
    expect(study.storm?.storm.hash).toBe(storm.storm.hash);
    expect(study.extent).toEqual(bbox);
    expect(study.elevation?.hash).toBe(elevation.hash);
    // Routed results are this build's own, with their per-cell grids, and agree with the file.
    expect(study.now?.cells.rows).toBe(36);
    expect(study.possible?.waterBalance.runoffM3).toBeCloseTo(possible.waterBalance.runoffM3, 6);
    expect(study.recorded.possible?.metadata.runoff_volume_m3).toBeCloseTo(possible.waterBalance.runoffM3, 6);
    expect(study.recorded.now).not.toHaveProperty("cells");
    expect(study.codeCommit).toEqual(expect.any(String));
  });

  it("still opens a file whose recorded result was edited, and names the failure", async () => {
    const edited = JSON.parse(exportText());
    edited.results.possible.metadata.runoff_volume_m3 -= 250;
    const study = await importExperiment(JSON.stringify(edited));
    expect(study.report.reproduced).toBe(false);
    expect(study.report.checks.find((c) => c.id === "evidence-hash")?.passed).toBe(false);
    expect(study.report.checks.find((c) => c.id === "possible-runoff_volume_m3")?.passed).toBe(false);
    // What is shown is the recomputation, not the edited number.
    expect(study.possible?.waterBalance.runoffM3).toBeCloseTo(possible.waterBalance.runoffM3, 6);
  });

  it("drops a forcing whose seal does not verify instead of showing results for it", async () => {
    const edited = JSON.parse(exportText());
    edited.storm.storm.rainfallDepthMm = 80;
    const study = await importExperiment(JSON.stringify(edited));
    expect(study.report.checks.find((c) => c.id === "storm-seal")?.passed).toBe(false);
    expect(study.storm).toBeNull();
    expect(study.now).toBeNull();
    expect(study.possible).toBeNull();
    expect(study.analysis.land_cover).toEqual(EXAMPLE_ANALYSIS.land_cover);
  });

  it("opens an export without a routed storm as a plain study", async () => {
    const text = JSON.stringify(buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [], storm: null, now: null, possible: null }));
    const study = await importExperiment(text);
    expect(study.report.reproduced).toBe(false);
    expect(study.report.checks.find((c) => c.id === "inputs-present")?.passed).toBe(false);
    expect(study.storm).toBeNull();
    expect(study.now).toBeNull();
    expect(study.analysis.status).toBe("example");
  });

  it("refuses files that are not experiment exports, with a reason", () => {
    expect(() => parseExperimentFile("not json")).toThrow(/not JSON/);
    expect(() => parseExperimentFile(JSON.stringify({ hello: 1 }))).toThrow(/names no schema/);
    expect(() => parseExperimentFile(JSON.stringify({ schema: "mannahatta-experiment-v9" }))).toThrow(/this build reads/i);
    expect(() => parseExperimentFile(JSON.stringify({ schema: "mannahatta-experiment-v4", evidenceHash: "x", study: { landCover: {}, bbox: null }, interventions: [], results: {} }))).toThrow(/study extent/);
    const invalidCover = JSON.parse(exportText());
    invalidCover.study.landCover.vegetation = -5;
    expect(() => parseExperimentFile(JSON.stringify(invalidCover))).not.toThrow();
    return expect(importExperiment(JSON.stringify(invalidCover))).rejects.toThrow(/land cover/);
  });

  it("reads a File through FileReader when Blob.text is missing", async () => {
    const blob = new Blob(['{"schema":"x"}'], { type: "application/json" });
    expect(await readFileText(blob)).toBe('{"schema":"x"}');
  });
});

describe("reopening an experiment that used an urban substrate", () => {
  const compiled = compileSubstrate(testSources(), TEST_CONFIG, { generatedAt: "2026-10-01T00:00:00.000Z", commit: null });
  const manifestText = serializeManifest(compiled.manifest);
  const [w, s] = coverageBBox(TEST_CONFIG);
  const studyBox = { west: w + 0.001, south: s + 0.001, east: w + 0.008, north: s + 0.006 };

  /** A fetch that serves the compiled substrate the way public/substrate would. */
  const served = (overrides: Record<string, string | null> = {}): typeof fetch =>
    (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = (text: string | null) => (text === null ? new Response(null, { status: 404 }) : new Response(text, { status: 200 }));
      if (url.endsWith("/substrate/index.json")) {
        return body(JSON.stringify({ schemaVersion: compiled.manifest.schemaVersion, substrates: [{ label: compiled.manifest.substrateVersion, title: "test", path: "test", manifestHash: compiled.manifest.hashes.manifest, bounds: compiled.manifest.bounds }] }));
      }
      if (url.endsWith("/substrate/test/manifest.json")) return body(manifestText);
      const tile = [...compiled.texts.keys()].find((id) => url.endsWith(`/substrate/test/${tilePath(id)}`));
      if (tile) return body(tile in overrides ? overrides[tile] : compiled.texts.get(tile)!);
      return new Response(null, { status: 404 });
    }) as typeof fetch;

  async function substrateExportText() {
    const view = await loadSubstrateView(memoryStore({ texts: compiled.texts, manifestText }), studyBox);
    const routed = { ...base, bbox: studyBox, elevation: syntheticElevation(studyBox, 36, 36), substrateHash: view.identity.identityHash };
    const pairNow = routeWatershed({ ...routed, surfaceId: "now", surfaceHash: "surface:now" });
    const pairPossible = routeWatershed({ ...routed, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([squareIntervention("bioswales", studyBox, 4000)], studyBox, 36, 36), expectedElevationHash: pairNow.elevationHash });
    const evidence = buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [squareIntervention("bioswales", studyBox, 4000)], storm, now: pairNow, possible: pairPossible, extent: studyBox, elevation: routed.elevation, substrate: substrateEvidence(view.identity, view) });
    return { view, text: JSON.stringify(evidence) };
  }

  it("fetches every recorded tile from the published store and verifies it", async () => {
    const { view, text } = await substrateExportText();
    const reader = await fetchSubstrateReader(view.identity, "/substrate/", served());
    expect(reader?.manifest()).toBe(manifestText);
    expect(view.identity.tileIds.every((id) => reader?.tile(id) !== null)).toBe(true);
    const study = await importExperiment(text, { fetch: served(), substrateBaseUrl: "/substrate/" });
    expect(study.report.reproduced).toBe(true);
    expect(study.substrate?.state.identityHash).toBe(view.identity.identityHash);
    expect(study.now?.metadata.substrate_hash).toBe(view.identity.identityHash);
  });

  it("fails the tile check when the server's tile differs, and when no store is reachable", async () => {
    const { view, text } = await substrateExportText();
    const tile = view.identity.tileIds.find((id) => id.includes("/512/"))!;
    const altered = await importExperiment(text, { fetch: served({ [tile]: compiled.texts.get(tile)!.replace('"crs":"EPSG:4326"', '"crs":"EPSG:3857"') }), substrateBaseUrl: "/substrate/" });
    expect(altered.report.reproduced).toBe(false);
    expect(altered.report.substrateMismatches).toContainEqual(expect.objectContaining({ kind: "tile-hash", tileId: tile }));
    const unreachable = await importExperiment(text, { fetch: (async () => new Response(null, { status: 503 })) as typeof fetch, substrateBaseUrl: "/substrate/" });
    expect(unreachable.report.reproduced).toBe(false);
    expect(unreachable.report.checks.find((c) => c.id === "substrate-manifest-present")?.passed).toBe(false);
    // The study still opens; the routed pair is this build's own and the substrate identity it recorded is kept.
    expect(unreachable.now?.metadata.substrate_hash).toBe(view.identity.identityHash);
  });
});
