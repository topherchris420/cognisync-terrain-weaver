import { DEFAULT_SUBSTRATE_LOADING, SUBSTRATE_INDEX_FILE } from "./config";
import { bboxToLocal, tileId, tilesIntersectingM, compareTileIds, parseTileId } from "./tile-id";
import { computeManifestHash, hashTileText, isCompatibleSchema, textBytes, tilePath } from "./manifest";
import { decodeRle } from "./layers/water";
import { geometryCentroidM, pointInRect, rectOverlapArea, rectsIntersect, type RectM } from "./geometry";
import { makeIdentity, type SubstrateIdentity } from "./identity";
import { toLocal } from "./projection";
import type { BBox, CompiledSubstrate, ContextTile, LocalTile, Position, SubstrateTile, UrbanSubstrateManifest } from "./types";

/**
 * Near/far substrate streaming, after BoundlessNYC's streamer: full-detail
 * LOCAL tiles around the study extent, coarse CONTEXT tiles farther out, and
 * nothing else. MapLibre stays the display; this only decides which compiled
 * tiles a study needs and proves each one is the tile the manifest names.
 */
export interface SubstrateStore {
  location: string;
  manifest(): Promise<string>;
  tile(tileId: string): Promise<string>;
}

export class SubstrateIntegrityError extends Error {
  constructor(
    message: string,
    readonly tileId: string | null,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(message);
    this.name = "SubstrateIntegrityError";
  }
}

export interface StudyExtent {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface LoaderOptions {
  localBufferM?: number;
  contextBufferM?: number;
  /** Load context tiles at all (default true). */
  context?: boolean;
  /** Clock for diagnostics; injectable for tests. */
  now?: () => number;
  concurrency?: number;
}

export interface SubstrateDiagnostics {
  localTiles: number;
  closureTiles: number;
  contextTiles: number;
  tileBytes: number;
  loadMs: number;
  features: number;
  vertices: number;
  /** Rough lower bound of memory held by the loaded tiles (bytes); not a measurement. */
  memoryEstimateBytes: number;
  /** Browser-reported JS heap, where the browser exposes it; null elsewhere. */
  jsHeapBytes: number | null;
}

export interface SubstrateView {
  manifest: UrbanSubstrateManifest;
  extent: StudyExtent;
  coverage: { status: "complete" | "partial" | "outside"; fraction: number };
  local: Map<string, LocalTile>;
  /** Local tiles loaded only because they own a feature the study's tiles reference. */
  closure: string[];
  context: Map<string, ContextTile>;
  identity: SubstrateIdentity;
  diagnostics: SubstrateDiagnostics;
}

export function httpStore(baseUrl: string, fetchImpl: typeof fetch = fetch): SubstrateStore {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const get = async (path: string) => {
    const response = await fetchImpl(`${base}${path}`);
    if (!response.ok) throw new Error(`Substrate request ${path} failed with HTTP ${response.status}`);
    return response.text();
  };
  return { location: base, manifest: () => get("manifest.json"), tile: (id) => get(tilePath(id)) };
}

export function memoryStore(compiled: Pick<CompiledSubstrate, "texts"> & { manifestText: string }, location = "memory"): SubstrateStore {
  return {
    location,
    manifest: async () => compiled.manifestText,
    tile: async (id) => {
      const text = compiled.texts.get(id);
      if (text === undefined) throw new Error(`Substrate tile ${id} is not in the store`);
      return text;
    },
  };
}

export interface SubstrateIndexEntry {
  label: string;
  title: string;
  /** Directory of the substrate, relative to the index. */
  path: string;
  manifestHash: string;
  bounds: BBox;
}

export interface SubstrateIndex {
  schemaVersion: string;
  substrates: SubstrateIndexEntry[];
}

export async function loadSubstrateIndex(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<SubstrateIndex> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const response = await fetchImpl(`${base}${SUBSTRATE_INDEX_FILE}`);
  if (!response.ok) throw new Error(`Substrate index failed with HTTP ${response.status}`);
  return (await response.json()) as SubstrateIndex;
}

/** The published substrate covering most of the extent, or null when none touches it. */
export function selectSubstrate(index: SubstrateIndex, extent: StudyExtent): SubstrateIndexEntry | null {
  const rect = bboxToLocal([extent.west, extent.south, extent.east, extent.north]);
  let best: SubstrateIndexEntry | null = null;
  let bestOverlap = 0;
  for (const entry of [...index.substrates].sort((a, b) => (a.label < b.label ? -1 : 1))) {
    const overlap = rectOverlapArea(rect, bboxToLocal(entry.bounds));
    if (overlap > bestOverlap) {
      best = entry;
      bestOverlap = overlap;
    }
  }
  return best;
}

function expand([x0, y0, x1, y1]: RectM, by: number): RectM {
  return [x0 - by, y0 - by, x1 + by, y1 + by];
}

/** Parse and verify a manifest: compatible schema and a hash that matches its content. */
export function parseManifest(text: string): UrbanSubstrateManifest {
  const manifest = JSON.parse(text) as UrbanSubstrateManifest;
  if (!isCompatibleSchema(manifest.schemaVersion)) {
    throw new SubstrateIntegrityError(`Unsupported substrate schema ${manifest.schemaVersion}`, null, "a supported schema", String(manifest.schemaVersion));
  }
  const recomputed = computeManifestHash(manifest);
  if (recomputed !== manifest.hashes.manifest) {
    throw new SubstrateIntegrityError("Substrate manifest content does not match its hash", null, manifest.hashes.manifest, recomputed);
  }
  return manifest;
}

function countGeometry(tile: SubstrateTile): { features: number; vertices: number } {
  let features = 0;
  let vertices = 0;
  const polygonal = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon | null) => {
    if (!g) return;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) for (const ring of polygon) vertices += ring.length;
  };
  for (const b of tile.layers.buildings) {
    features += 1;
    polygonal(b.footprint);
  }
  for (const s of tile.layers.streets) {
    features += 1;
    vertices += s.geometry.coordinates.length;
  }
  if (tile.level === "local") {
    for (const s of tile.layers.streets) polygonal(s.surface);
    for (const w of tile.layers.water.bodies) {
      features += 1;
      polygonal(w.geometry);
    }
    for (const p of tile.layers.vegetation.parkProperties) {
      features += 1;
      polygonal(p.geometry);
    }
    features += tile.layers.vegetation.trees.length + tile.layers.streetGraph.nodes.length + tile.layers.streetGraph.edges.length;
    vertices += tile.layers.vegetation.trees.length + tile.layers.streetGraph.nodes.length;
  }
  return { features, vertices };
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Which tiles a study extent needs, before closure: LOCAL tiles touching the
 * extent plus a buffer, and CONTEXT tiles touching a wider buffer. Only tiles
 * the manifest lists are planned. Deterministic and synchronous.
 */
export function planSubstrateTiles(
  manifest: Pick<UrbanSubstrateManifest, "hashes">,
  extent: StudyExtent,
  options: { localBufferM?: number; contextBufferM?: number; context?: boolean } = {},
): { local: string[]; context: string[]; localRect: RectM } {
  const rect = bboxToLocal([extent.west, extent.south, extent.east, extent.north]);
  const listed = (id: string) => id in manifest.hashes.tiles;
  const localBufferM = options.localBufferM ?? DEFAULT_SUBSTRATE_LOADING.localBufferM;
  const contextBufferM = options.contextBufferM ?? DEFAULT_SUBSTRATE_LOADING.contextBufferM;
  return {
    localRect: expand(rect, localBufferM),
    local: tilesIntersectingM("local", expand(rect, localBufferM)).map((k) => tileId("local", k.ix, k.iy)).filter(listed),
    context: options.context === false ? [] : tilesIntersectingM("context", expand(rect, contextBufferM)).map((k) => tileId("context", k.ix, k.iy)).filter(listed),
  };
}

/**
 * Local tiles that own a referenced feature touching `rect` (the extent plus
 * its local buffer) and are not loaded yet. Features that only cross the far
 * side of a buffer tile never pull in another tile.
 */
export function closureTiles(manifest: Pick<UrbanSubstrateManifest, "hashes">, local: Map<string, LocalTile>, rect: RectM): string[] {
  const owners = new Set<string>();
  for (const tile of local.values()) {
    for (const refs of Object.values(tile.refs)) {
      for (const [, owner, bounds] of refs) {
        if (!local.has(owner) && owner in manifest.hashes.tiles && rectsIntersect(bounds, rect)) owners.add(owner);
      }
    }
  }
  return [...owners].sort(compareTileIds);
}

/**
 * Load the substrate a study extent needs. Throws SubstrateIntegrityError if
 * any tile's content differs from its manifest hash: a study never proceeds
 * on a substrate it cannot identify.
 */
export async function loadSubstrateView(store: SubstrateStore, extent: StudyExtent, options: LoaderOptions = {}): Promise<SubstrateView> {
  const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const started = now();
  const manifest = parseManifest(await store.manifest());
  const localBufferM = options.localBufferM ?? DEFAULT_SUBSTRATE_LOADING.localBufferM;
  const contextBufferM = options.contextBufferM ?? DEFAULT_SUBSTRATE_LOADING.contextBufferM;
  const rect = bboxToLocal([extent.west, extent.south, extent.east, extent.north]);
  const coverageRect = bboxToLocal(manifest.bounds);
  const extentArea = Math.max(1e-9, (rect[2] - rect[0]) * (rect[3] - rect[1]));
  const fraction = Math.min(1, rectOverlapArea(rect, coverageRect) / extentArea);

  const plan = planSubstrateTiles(manifest, extent, { localBufferM, contextBufferM, context: options.context });

  let bytes = 0;
  const fetchTile = async (id: string): Promise<SubstrateTile> => {
    const text = await store.tile(id);
    bytes += textBytes(text);
    const actual = hashTileText(text);
    const expected = manifest.hashes.tiles[id];
    if (actual !== expected) throw new SubstrateIntegrityError(`Substrate tile ${id} does not match its manifest hash`, id, expected, actual);
    return JSON.parse(text) as SubstrateTile;
  };
  const concurrency = options.concurrency ?? 6;
  const local = new Map<string, LocalTile>();
  for (const tile of await mapLimited(plan.local, concurrency, fetchTile)) if (tile.level === "local") local.set(tile.tileId, tile);

  // Closure: tiles that own features referenced by the study's tiles.
  const closure = closureTiles(manifest, local, plan.localRect);
  for (const tile of await mapLimited(closure, concurrency, fetchTile)) if (tile.level === "local") local.set(tile.tileId, tile);
  const wantedContext = plan.context;

  const context = new Map<string, ContextTile>();
  for (const tile of await mapLimited(wantedContext, concurrency, fetchTile)) if (tile.level === "context") context.set(tile.tileId, tile);

  const all: SubstrateTile[] = [...local.values(), ...context.values()];
  const geometry = all.map(countGeometry).reduce((a, b) => ({ features: a.features + b.features, vertices: a.vertices + b.vertices }), { features: 0, vertices: 0 });
  const tileHashes = Object.fromEntries(all.map((t) => [t.tileId, manifest.hashes.tiles[t.tileId]]));
  const heap = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number } } }).performance?.memory?.usedJSHeapSize;
  return {
    manifest,
    extent,
    coverage: { status: fraction >= 0.999 ? "complete" : fraction > 0 ? "partial" : "outside", fraction: Math.round(fraction * 1e4) / 1e4 },
    local,
    closure,
    context,
    identity: makeIdentity({ schemaVersion: manifest.schemaVersion, substrateVersion: manifest.substrateVersion, manifestHash: manifest.hashes.manifest, tileHashes }),
    diagnostics: {
      localTiles: local.size - closure.length,
      closureTiles: closure.length,
      contextTiles: context.size,
      tileBytes: bytes,
      loadMs: Math.round(now() - started),
      features: geometry.features,
      vertices: geometry.vertices,
      // Two doubles per vertex plus a small per-feature object overhead; a floor, not a measurement.
      memoryEstimateBytes: geometry.vertices * 16 + geometry.features * 120 + bytes,
      jsHeapBytes: typeof heap === "number" ? heap : null,
    },
  };
}

/* ---------------------------------------------------------- study queries */

const inRect = (rect: RectM, position: Position) => pointInRect(toLocal(position[0], position[1]), rect);

/**
 * Observed and reference facts about the study extent, each kept with its
 * own evidence status. Nothing here is combined with, or substituted for,
 * the AI land-cover classification.
 */
export function studySummary(view: SubstrateView) {
  const rect = bboxToLocal([view.extent.west, view.extent.south, view.extent.east, view.extent.north]);
  let buildings = 0;
  let footprintM2 = 0;
  let buildingsWithHeight = 0;
  let streets = 0;
  let streetsWithWidth = 0;
  let trees = 0;
  let water = 0;
  let land = 0;
  let noData = 0;
  for (const tile of view.local.values()) {
    for (const b of tile.layers.buildings) {
      if (!inRect(rect, b.centroid)) continue;
      buildings += 1;
      footprintM2 += b.footprintAreaM2;
      if (b.roofHeightM !== null) buildingsWithHeight += 1;
    }
    for (const s of tile.layers.streets) {
      const coords = s.geometry.coordinates as Position[];
      if (!inRect(rect, coords[Math.floor(coords.length / 2)])) continue;
      streets += 1;
      if (s.widthM !== null) streetsWithWidth += 1;
    }
    for (const t of tile.layers.vegetation.trees) if (inRect(rect, t.position)) trees += 1;
    const key = parseTileId(tile.tileId)!;
    const cell = tile.layers.water.mask.cellSizeM;
    const west = key.ix * key.sizeM;
    const north = (key.iy + 1) * key.sizeM;
    const symbols = decodeRle(tile.layers.water.mask.rle);
    for (let i = 0; i < symbols.length; i += 1) {
      const row = Math.floor(i / tile.layers.water.mask.cols);
      const col = i % tile.layers.water.mask.cols;
      const x = west + (col + 0.5) * cell;
      const y = north - (row + 0.5) * cell;
      if (!pointInRect([x, y], rect)) continue;
      if (symbols[i] === "W") water += 1;
      else if (symbols[i] === "L") land += 1;
      else noData += 1;
    }
  }
  const cells = water + land + noData;
  return {
    buildings,
    footprintM2: Math.round(footprintM2),
    buildingsWithHeight,
    streets,
    streetsWithWidth,
    trees,
    openWaterShare: cells ? Math.round((water / cells) * 1000) / 1000 : null,
    noDataShare: cells ? Math.round((noData / cells) * 1000) / 1000 : null,
  };
}

/** Features to draw: local detail, plus context features outside every loaded local tile. */
export function displayFeatures(view: SubstrateView): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const seen = new Set<string>();
  const localRects = [...view.local.values()].map((t) => bboxToLocal(t.bounds));
  for (const tile of view.local.values()) {
    for (const b of tile.layers.buildings) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      features.push({ type: "Feature", id: b.id, geometry: b.footprint, properties: { kind: "building", level: "local", heightM: b.roofHeightM } });
    }
    for (const s of tile.layers.streets) {
      if (seen.has(s.id) || !s.physical) continue;
      seen.add(s.id);
      features.push({ type: "Feature", id: s.id, geometry: s.geometry, properties: { kind: "street", level: "local", roadClass: s.roadClass } });
    }
  }
  for (const tile of view.context.values()) {
    for (const b of tile.layers.buildings) {
      if (seen.has(b.id)) continue;
      const centre = geometryCentroidM(b.footprint);
      if (localRects.some((r) => pointInRect(centre, r))) continue;
      features.push({ type: "Feature", id: b.id, geometry: b.footprint, properties: { kind: "building", level: "context", heightM: b.roofHeightM } });
    }
  }
  return { type: "FeatureCollection", features };
}
