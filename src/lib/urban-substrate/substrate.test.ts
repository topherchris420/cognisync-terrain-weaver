import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex, sha256Text, utf8, contentHash } from "./sha256";
import { bboxToLocal, compareTileIds, contextTileOf, parseTileId, tileBoundsLonLat, tileBoundsM, tileId, tileIdForLonLat, tilesIntersectingM } from "./tile-id";
import { clipRingToRect, geometryAreaM2, geometryCentroidM, offsetRibbon, ringSelfIntersects, scanlineFill, segmentIntersectsRect, signedArea, simplifyLine } from "./geometry";
import { quantizeDegrees, toLocal, toLonLat } from "./projection";
import { compileSubstrate } from "./compiler";
import { computeManifestHash, hashTileText, serializeManifest } from "./manifest";
import { decodeRle, encodeRle } from "./layers/water";
import { normalizePolygonal } from "./layers/common";
import { TEST_CONFIG, shuffledSources, testSources } from "./test-fixtures";
import { loadSubstrateView, memoryStore, studySummary, SubstrateIntegrityError, displayFeatures } from "./loader";
import { verifySubstrateIdentity, describeMismatches, type SubstrateReader } from "./replay";
import { substrateRunKey, SUBSTRATE_NONE, unavailable } from "./identity";
import { validateSubstrate } from "./validation";
import { coverageBBox, coverageRectM } from "./regions";
import type { LocalTile } from "./types";

const meta = { generatedAt: "2026-10-01T00:00:00.000Z", commit: "test" };
const [TEST_X0, TEST_Y0] = coverageRectM(TEST_CONFIG);

function compileTest(sources = testSources(), generatedAt = meta.generatedAt) {
  return compileSubstrate(sources, TEST_CONFIG, { ...meta, generatedAt });
}

function reader(compiled: ReturnType<typeof compileTest>, overrides: Record<string, string | null> = {}): SubstrateReader {
  return {
    location: "memory",
    manifest: () => serializeManifest(compiled.manifest),
    tile: (id) => (id in overrides ? overrides[id] : compiled.texts.get(id) ?? null),
  };
}

describe("SHA-256", () => {
  it("matches FIPS 180-4 vectors and node:crypto at every block boundary", () => {
    expect(sha256Hex(utf8("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(utf8(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    for (const n of [0, 1, 54, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const text = "é".repeat(n % 7) + "x".repeat(n);
      expect(sha256Text(text)).toBe(`sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`);
    }
  });

  it("hashes content, not formatting or key order", () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
    expect(hashTileText('{ "b": 2, "a": 1 }')).toBe(contentHash({ a: 1, b: 2 }));
  });
});

describe("deterministic tile identity", () => {
  it("formats and parses ids, and rejects unknown sizes", () => {
    expect(tileId("local", 183, 294)).toBe("nyc/512/183/294");
    expect(tileId("context", -1, 3)).toBe("nyc/2048/-1/3");
    expect(parseTileId("nyc/512/183/294")).toEqual({ region: "nyc", level: "local", sizeM: 512, ix: 183, iy: 294 });
    expect(parseTileId("nyc/300/1/1")).toBeNull();
    expect(parseTileId("nyc/512/1.5/1")).toBeNull();
    expect(() => tileId("local", 1.5, 2)).toThrow();
  });

  it("places the example extent on a stable 3 × 3 block of local tiles", () => {
    const keys = tilesIntersectingM("local", bboxToLocal([-74.014, 40.703, -74.004, 40.712])).map((k) => `${k.ix}/${k.iy}`);
    expect(keys).toEqual(["40/46", "41/46", "42/46", "40/47", "41/47", "42/47", "40/48", "41/48", "42/48"]);
    expect(tileIdForLonLat("local", -74.009, 40.7075)).toBe("nyc/512/41/47");
  });

  it("does not pull in a neighbour for a box ending exactly on a tile edge", () => {
    expect(tilesIntersectingM("local", [0, 0, 512, 512]).length).toBe(1);
    expect(tilesIntersectingM("local", [512, 512, 512, 512]).map((k) => `${k.ix}/${k.iy}`)).toEqual(["1/1"]);
  });

  it("round-trips the projection and keeps tile bounds on the grid", () => {
    const [x, y] = toLocal(-74.0101, 40.7101);
    const [lon, lat] = toLonLat(x, y);
    expect(quantizeDegrees(lon)).toBe(-74.0101);
    expect(quantizeDegrees(lat)).toBe(40.7101);
    const [w, s, e, n] = tileBoundsLonLat("local", 41, 47);
    expect(w < e && s < n).toBe(true);
    expect(tileBoundsM("local", 41, 47)).toEqual([20992, 24064, 21504, 24576]);
    expect(contextTileOf(41, 47)).toEqual([10, 11]);
    expect(["nyc/2048/10/11", "nyc/512/41/47", "nyc/512/40/47", "nyc/512/40/46"].sort(compareTileIds)).toEqual(["nyc/512/40/46", "nyc/512/40/47", "nyc/512/41/47", "nyc/2048/10/11"]);
  });
});

describe("geometry kernel", () => {
  const square: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

  it("computes areas, centroids, clipping and fills from basic arithmetic", () => {
    expect(signedArea(square)).toBe(100);
    expect(clipRingToRect(square, [5, -5, 20, 20]).length).toBeGreaterThanOrEqual(5);
    expect(Math.abs(signedArea(clipRingToRect(square, [5, -5, 20, 20])))).toBe(50);
    expect(segmentIntersectsRect([-5, 5], [5, 5], [0, 0, 10, 10])).toBe(true);
    expect(segmentIntersectsRect([-5, 15], [5, 15], [0, 0, 10, 10])).toBe(false);
    const fill = scanlineFill([square], -10, 20, 5, 6, 6);
    expect(fill.reduce((a, b) => a + b, 0)).toBe(4);
    const ribbon = offsetRibbon([[0, 0], [100, 0]], 5)!;
    expect(Math.abs(signedArea(ribbon))).toBeCloseTo(1000, 6);
    expect(simplifyLine([[0, 0], [1, 0.01], [2, 0]], 0.1)).toEqual([[0, 0], [2, 0]]);
    expect(ringSelfIntersects([[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]])).toBe(true);
    expect(ringSelfIntersects(square)).toBe(false);
  });

  it("normalises polygons without repairing them, and says what it found", () => {
    // A symmetric bowtie has zero signed area and is dropped as such; this one is lopsided.
    const bowtie = { type: "Polygon", coordinates: [[[-74, 40.7], [-73.998, 40.701], [-73.998, 40.7], [-74, 40.702], [-74, 40.7]]] };
    const { geometry, issues } = normalizePolygonal(bowtie);
    expect(geometry).not.toBeNull();
    expect(issues).toContain("source-self-intersection");
    const clockwise = { type: "Polygon", coordinates: [[[-74, 40.7], [-74, 40.701], [-73.999, 40.701], [-73.999, 40.7], [-74, 40.7]]] };
    const oriented = normalizePolygonal(clockwise).geometry as GeoJSON.Polygon;
    expect(geometryAreaM2(oriented)).toBeGreaterThan(0);
    expect(normalizePolygonal({ type: "Point", coordinates: [0, 0] }).geometry).toBeNull();
    expect(geometryCentroidM(oriented)[0]).toBeGreaterThan(0);
  });

  it("run-length encodes masks losslessly", () => {
    const symbols = ["L", "L", "W", "N", "N", "N", "L"];
    expect(encodeRle(symbols)).toBe("L2W1N3L1");
    expect(decodeRle(encodeRle(symbols))).toEqual(symbols);
  });
});

describe("urban substrate compiler", () => {
  const compiled = compileTest();

  it("compiles the same sources to byte-identical tiles and manifest, whatever the record order or clock", () => {
    const again = compileTest(testSources(), "2030-01-01T00:00:00.000Z");
    const shuffled = compileSubstrate(shuffledSources(testSources(), 1609), TEST_CONFIG, { generatedAt: "1999-01-01T00:00:00.000Z", commit: "other" });
    for (const other of [again, shuffled]) {
      expect([...other.texts.keys()]).toEqual([...compiled.texts.keys()]);
      for (const [id, text] of compiled.texts) expect(other.texts.get(id)).toBe(text);
      expect(other.manifest.hashes).toEqual(compiled.manifest.hashes);
    }
    // The timestamp and commit are recorded, but they are not identity.
    expect(again.manifest.generatedAt).not.toBe(compiled.manifest.generatedAt);
    expect(computeManifestHash(again.manifest)).toBe(compiled.manifest.hashes.manifest);
  });

  it("validates with no errors and records sources for every layer", () => {
    expect(compiled.manifest.validation.errors).toBe(0);
    for (const layer of Object.values(compiled.manifest.layers)) expect(layer.sources.length).toBeGreaterThan(0);
    expect(compiled.manifest.sources.every((s) => s.contentHash.startsWith("sha256:"))).toBe(true);
    expect(compiled.manifest.compiler.config.randomness).toBe("none");
  });

  it("never fabricates unknown attributes", () => {
    const tiles = [...compiled.tiles.values()].filter((t): t is LocalTile => t.level === "local");
    const buildings = tiles.flatMap((t) => t.layers.buildings);
    const straddling = buildings.find((b) => b.id === "bldg:12")!;
    expect(straddling.roofHeightM).toBeNull(); // the source records 0: "not available"
    expect(straddling.bin).toBeNull(); // dummy BIN 1000000 is not an identifier
    const withLot = buildings.find((b) => b.id === "bldg:11")!;
    expect(withLot.roofHeightM).toBeCloseTo(30.48, 2);
    expect(withLot.lot?.landUseLabel).toBe("Commercial & office buildings");
    const streets = tiles.flatMap((t) => t.layers.streets);
    const noWidth = streets.find((s) => s.id === "street:b")!;
    expect(noWidth.widthM).toBeNull();
    expect(noWidth.surface).toBeNull();
    expect(streets.find((s) => s.id === "street:e")!.physical).toBe(false);
    const stump = tiles.flatMap((t) => t.layers.vegetation.trees).find((t) => t.id === "tree:2")!;
    expect(stump.dbhCm).toBeNull();
  });

  it("assigns each feature to exactly one tile and references it from the others it touches", () => {
    const local = [...compiled.tiles.values()].filter((t): t is LocalTile => t.level === "local");
    const owners = local.filter((t) => t.layers.buildings.some((b) => b.id === "bldg:12"));
    expect(owners.length).toBe(1);
    const referencing = local.filter((t) => (t.refs.buildings ?? []).some(([id]) => id === "bldg:12"));
    expect(referencing.map((t) => t.tileId)).not.toContain(owners[0].tileId);
    expect(referencing.length).toBeGreaterThan(0);
  });

  it("keeps grade-separated structure out of the street graph's junctions", () => {
    const local = [...compiled.tiles.values()].filter((t): t is LocalTile => t.level === "local");
    const nodes = local.flatMap((t) => t.layers.streetGraph.nodes);
    const edges = local.flatMap((t) => t.layers.streetGraph.edges);
    const junction = nodes.find((n) => n.kind === "intersection")!;
    expect(junction.degree).toBe(3);
    const bridge = edges.find((e) => e.segmentId === "street:d")!;
    expect(bridge.gradeSeparated).toBe(true);
    expect(bridge.slope).toBeNull();
    expect([bridge.from, bridge.to]).not.toContain(junction.id);
    const ped = local.flatMap((t) => t.layers.pedestrianGraph.excluded);
    expect(ped).toContainEqual([bridge.id, "nonped-flag"]);
  });

  it("treats open water as receiving water, separate from land and from no-data", () => {
    const local = [...compiled.tiles.values()].filter((t): t is LocalTile => t.level === "local");
    expect(local.some((t) => t.layers.water.waterCells > 0)).toBe(true);
    for (const t of local) {
      expect(t.layers.water.role).toBe("receiving-water");
      const r = t.layers.landCover?.reference;
      if (r) expect(r.perviousPct).toBeLessThanOrEqual(100 - r.waterPct + 0.01);
    }
    const context = [...compiled.tiles.values()].find((t) => t.level === "context")!;
    expect(context.layers.water.noDataCells).toBeGreaterThan(0); // outside coverage is unknown, not water
  });

  it("labels the surface-flow graph as experimental and never as a drainage model", () => {
    const layer = compiled.manifest.layers.surfaceFlowGraph;
    expect(layer.caveats.join(" ")).toMatch(/Not a sewer or drainage-network model/);
    expect(layer.caveats.join(" ")).toMatch(/not used by any routed result/);
  });

  it("detects a tampered tile in validation", () => {
    const tiles = new Map(compiled.tiles);
    const first = [...tiles.keys()][0];
    const tampered = JSON.parse(compiled.texts.get(first)!);
    tampered.coverage.coveredFraction = 0.5;
    tiles.set(first, tampered);
    const result = validateSubstrate(compiled.manifest, tiles);
    expect(result.checks.find((c) => c.id === "tile-hashes")!.passed).toBe(false);
  });
});

describe("near/far loading and replay verification", () => {
  const compiled = compileTest();
  const manifestText = serializeManifest(compiled.manifest);
  const store = memoryStore({ texts: compiled.texts, manifestText });
  const [w, s] = coverageBBox(TEST_CONFIG);
  // A small extent in the south-west local tile.
  const extent = { west: w + 0.0005, south: s + 0.0005, east: w + 0.001, north: s + 0.001 };

  it("loads only the local tiles the extent needs, plus their closure and context", async () => {
    let t = 0;
    const view = await loadSubstrateView(store, extent, { localBufferM: 0, now: () => (t += 5) });
    expect(view.diagnostics.localTiles).toBe(1);
    expect(view.context.size).toBeGreaterThan(0);
    expect(view.identity.tileIds.length).toBe(view.local.size + view.context.size);
    expect(view.diagnostics.tileBytes).toBeGreaterThan(0);
    expect(view.diagnostics.loadMs).toBeGreaterThan(0);
    expect(view.coverage.status).toBe("complete");
    expect(studySummary(view).noDataShare).toBe(0);
    expect(displayFeatures(view).features.length).toBeGreaterThan(0);
  });

  it("pulls in an owner tile only for referenced features that touch the requested area", async () => {
    const [x0, y0] = [TEST_X0, TEST_Y0];
    const at = (x: number, y: number) => toLonLat(x0 + x, y0 + y);
    // Building 12 straddles x = 512 m at y ≈ 700 m and is owned by the eastern tile.
    const [w1, s1] = at(495, 690);
    const [e1, n1] = at(505, 710);
    const touching = await loadSubstrateView(store, { west: w1, south: s1, east: e1, north: n1 }, { localBufferM: 0, context: false });
    expect(touching.closure).toContain(tileId("local", 41, 47));
    const [w2, s2] = at(100, 900);
    const [e2, n2] = at(110, 910);
    const away = await loadSubstrateView(store, { west: w2, south: s2, east: e2, north: n2 }, { localBufferM: 0, context: false });
    expect(away.closure).toEqual([]);
  });

  it("refuses a tile whose content does not match the manifest", async () => {
    const id = [...compiled.texts.keys()].find((k) => k.startsWith("nyc/512/40/46"))!;
    const tampered = memoryStore({ texts: new Map([...compiled.texts, [id, compiled.texts.get(id)!.replace('"coveredFraction":1', '"coveredFraction":0.9')]]), manifestText });
    await expect(loadSubstrateView(tampered, extent, { localBufferM: 0 })).rejects.toBeInstanceOf(SubstrateIntegrityError);
  });

  it("verifies an identity, and fails closed on a missing or altered tile", async () => {
    const view = await loadSubstrateView(store, extent);
    const ok = verifySubstrateIdentity(view.identity, reader(compiled));
    expect(ok.verified).toBe(true);

    const target = view.identity.tileIds[0];
    const altered = verifySubstrateIdentity(view.identity, reader(compiled, { [target]: compiled.texts.get(target)!.replace('"crs":"EPSG:4326"', '"crs":"EPSG:4269"') }));
    expect(altered.verified).toBe(false);
    expect(altered.mismatches[0]).toMatchObject({ kind: "tile-hash", tileId: target, expected: view.identity.tileHashes[target] });
    expect(describeMismatches(altered.mismatches).join("\n")).toMatch(/Substrate mismatch:\ntile: {5}nyc\/\d+\/-?\d+\/-?\d+\nexpected: sha256:[0-9a-f]{64}\nactual: {3}sha256:/);

    const missing = verifySubstrateIdentity(view.identity, reader(compiled, { [target]: null }));
    expect(missing.mismatches[0].kind).toBe("missing-tile");
    expect(verifySubstrateIdentity(view.identity, null).verified).toBe(false);
    expect(verifySubstrateIdentity({ ...view.identity, schemaVersion: "mannahatta-substrate/99" }, reader(compiled)).verified).toBe(false);
    expect(verifySubstrateIdentity({ ...view.identity, manifestHash: "sha256:00" }, reader(compiled)).verified).toBe(false);
  });

  it("gives every run a substrate key, so pairs with different substrates cannot match", () => {
    expect(substrateRunKey(null)).toBe(SUBSTRATE_NONE);
    expect(substrateRunKey(unavailable("outside-coverage", "x"))).toBe("substrate:unavailable:outside-coverage");
  });
});
