import { contentHash } from "./sha256";
import {
  COORDINATE_DECIMALS,
  SUBSTRATE_COMPILER,
  SUBSTRATE_CRS,
  SUBSTRATE_GRID,
  SUBSTRATE_LEVELS,
  SUBSTRATE_SCHEMA_VERSION,
  type SubstrateLevel,
} from "./config";
import { geometryCentroidM, lineIntersectsRect, pointAlong, positionsToLocal, rectOverlapArea, type RectM } from "./geometry";
import { computeManifestHash, serializeTile, textBytes, tilePath } from "./manifest";
import { toLocal, type XY } from "./projection";
import { sourceRecord } from "./provenance";
import { coverageBBox, coverageRectM } from "./regions";
import type { SubstrateSources } from "./sources";
import { compareTileIds, tileBoundsLonLat, tileBoundsM, tileId, tileIndexForPoint, tilesIntersectingM } from "./tile-id";
import type {
  CompiledSubstrate,
  ContextTile,
  LayerId,
  LayerManifest,
  LocalTile,
  Position,
  StreetGraphEdge,
  StreetGraphNode,
  StreetSegmentFeature,
  SubstrateCompilerConfig,
  SubstrateTile,
  SurfaceFlowEdge,
  SurfaceFlowNode,
  TileEntry,
  TileRef,
  UrbanSubstrateManifest,
} from "./types";
import { BUILDING_ATTRIBUTES, BUILDINGS_SOURCE, PLUTO_SOURCE, contextBuilding, normalizeBuildings } from "./layers/buildings";
import { STREET_ATTRIBUTES, STREETS_SOURCE, contextStreet, normalizeStreets } from "./layers/streets";
import { ELEVATION_ATTRIBUTES, ELEVATION_SOURCE, ElevationLattice } from "./layers/elevation";
import { LandWaterMask, SHORELINE_SOURCE, WATER_ATTRIBUTES, WATER_BODIES_SOURCE, encodeRle, normalizeWaterBodies } from "./layers/water";
import { LAND_COVER_ATTRIBUTES, NLCD_SOURCE, landCoverByTile } from "./layers/land-cover";
import { PARKS_SOURCE, TREES_SOURCE, VEGETATION_ATTRIBUTES, normalizeParks, normalizeTrees } from "./layers/vegetation";
import { buildStreetGraph } from "./graph/street-graph";
import { pedestrianAccess } from "./graph/sidewalk-graph";
import { SURFACE_FLOW_CAVEATS, buildSurfaceFlowGraph } from "./graph/surface-graph";
import { validateSubstrate } from "./validation";

export interface CompileMeta {
  /** Non-authoritative; excluded from the manifest hash. */
  generatedAt: string;
  /** Non-authoritative; excluded from the manifest hash. */
  commit: string | null;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byFirst = (a: [string, string], b: [string, string]) => byString(a[0], b[0]) || byString(a[1], b[1]);

function stripXY<T extends { xy: XY }>(value: T): Omit<T, "xy"> {
  const { xy: _xy, ...rest } = value;
  return rest;
}

/**
 * Compile frozen public records into versioned, deterministic tiles.
 *
 * Given the same sources, config and compiler version, the output is
 * byte-identical: every collection is sorted by a stable id, every number is
 * rounded to a fixed precision, no randomness or clock enters content, and
 * input record order does not matter. `meta` is recorded but never hashed.
 */
export function compileSubstrate(sources: SubstrateSources, config: SubstrateCompilerConfig, meta: CompileMeta): CompiledSubstrate {
  const coverage = coverageRectM(config);
  const inCoverage = ([x, y]: XY) => x >= coverage[0] && x < coverage[2] && y >= coverage[1] && y < coverage[3];
  const { ixMin, iyMin, ixMax, iyMax } = config.coverageTiles;
  const localKeys: Array<[number, number]> = [];
  for (let iy = iyMin; iy <= iyMax; iy += 1) for (let ix = ixMin; ix <= ixMax; ix += 1) localKeys.push([ix, iy]);
  const localIds = new Set(localKeys.map(([ix, iy]) => tileId("local", ix, iy)));
  const ownerOf = (xy: XY): string | null => {
    const [ix, iy] = tileIndexForPoint("local", xy);
    const id = tileId("local", ix, iy);
    return localIds.has(id) ? id : null;
  };
  const coveredLocalTiles = (rect: RectM) =>
    tilesIntersectingM("local", rect)
      .map((k) => ({ id: tileId("local", k.ix, k.iy), rect: tileBoundsM("local", k.ix, k.iy) }))
      .filter((t) => localIds.has(t.id));

  /* --------------------------------------------------------- provenance */
  const sourceRecords = [
    sourceRecord(sources.buildings, sources.buildings.data.length),
    sourceRecord(sources.pluto, sources.pluto.data.length),
    sourceRecord(sources.streets, sources.streets.data.length),
    sourceRecord(sources.waterBodies, sources.waterBodies.data.length),
    sourceRecord(sources.shoreline, sources.shoreline.data.length),
    sourceRecord(sources.parks, sources.parks.data.length),
    sourceRecord(sources.trees, sources.trees.data.length),
    sourceRecord(sources.elevation, sources.elevation.data.valuesCm.length),
    sourceRecord(sources.nlcd, sources.nlcd.data.landCover.length),
  ].sort((a, b) => byString(a.sourceId, b.sourceId));

  /* ------------------------------------------------------- normalisation */
  const buildings = normalizeBuildings(sources.buildings.data, sources.pluto.data);
  const streets = normalizeStreets(sources.streets.data);
  const waterBodies = normalizeWaterBodies(sources.waterBodies.data);
  const trees = normalizeTrees(sources.trees.data);
  const parks = normalizeParks(sources.parks.data);
  const lattice = new ElevationLattice(sources.elevation.data, config.elevation.localCellM, coverage, config.elevation.artefactBelowM);
  const mask = new LandWaterMask(sources.shoreline.data, coverage, config.water.localCellM);

  /* ----------------------------------------------------------- ownership */
  const outside: Record<string, number> = { buildings: 0, streets: 0, waterBodies: 0, parkProperties: 0, trees: 0 };
  const owned = <T>(layer: string, items: T[], locate: (item: T) => XY) => {
    const out: Array<{ item: T; owner: string; xy: XY }> = [];
    for (const item of items) {
      const xy = locate(item);
      const owner = ownerOf(xy);
      if (owner) out.push({ item, owner, xy });
      else outside[layer] += 1;
    }
    return out;
  };
  const ownedBuildings = owned("buildings", buildings.features, (b) => toLocal(b.centroid[0], b.centroid[1]));
  const streetLocal = new Map(streets.features.map((s) => [s.id, positionsToLocal(s.geometry.coordinates as Position[])]));
  const ownedStreets = owned("streets", streets.features, (s) => pointAlong(streetLocal.get(s.id)!, s.lengthM / 2));
  const ownedWater = owned("waterBodies", waterBodies.features, (w) => geometryCentroidM(w.geometry));
  const ownedParks = owned("parkProperties", parks.features, (p) => geometryCentroidM(p.geometry));
  const ownedTrees = owned("trees", trees.features, (t) => toLocal(t.position[0], t.position[1]));
  const streetOwner = new Map(ownedStreets.map((s) => [s.item.id, s.owner]));

  /* --------------------------------------------------------------- graphs */
  const compiledIds = new Set(ownedStreets.map((s) => s.item.id));
  const graphSegments = ownedStreets.map((s) => s.item).filter((s) => s.physical);
  const graph = buildStreetGraph(graphSegments, {
    mergeToleranceM: config.graph.nodeMergeToleranceM,
    elevationAt: (x, y) => lattice.sampleM(x, y),
    inCoverage,
    excluded: streets.features.filter((s) => s.physical && !compiledIds.has(s.id)),
  });
  const edgeOwner = new Map(graph.edges.map((e) => [e.id, streetOwner.get(e.segmentId)!]));
  const incidentOwner = new Map<string, string>();
  for (const edge of graph.edges) {
    for (const node of [edge.from, edge.to]) if (!incidentOwner.has(node)) incidentOwner.set(node, edgeOwner.get(edge.id)!);
  }
  const nodeOwner = new Map([...graph.nodes.values()].map((n) => [n.id, ownerOf(n.xy) ?? incidentOwner.get(n.id)!]));
  const segmentById = new Map(streets.features.map((s) => [s.id, s]));
  const access = pedestrianAccess(graph.edges, segmentById);
  const surface = buildSurfaceFlowGraph({
    streetNodes: graph.nodes,
    streetEdges: graph.edges,
    lattice,
    mask,
    inCoverage,
    receiverTileOf: (xy) => ownerOf(xy) ?? "outside",
    flatSlope: config.graph.flatSlope,
    receiverReachM: config.graph.receiverReachM,
    lowPointSnapM: config.graph.lowPointSnapM,
  });
  const surfaceNodeOwner = new Map(
    surface.nodes.map((n) => [
      n.id,
      n.streetNodeId ? nodeOwner.get(n.streetNodeId)! : n.kind === "water-receiver" ? n.id.replace("sf:receiver:", "") : ownerOf(n.xy)!,
    ]),
  );
  const surfaceEdgeOwner = (e: (typeof surface.edges)[number]) =>
    e.ownerStreetEdgeId ? edgeOwner.get(e.ownerStreetEdgeId)! : e.kind === "sink-to-receiver" ? surfaceNodeOwner.get(e.from)! : ownerOf(e.ownerXY)!;

  /* ----------------------------------------------------------------- refs */
  const refs = new Map<string, Record<string, TileRef[]>>();
  const addRef = (tile: string, layer: string, featureId: string, owner: string, bounds: RectM) => {
    if (tile === owner) return;
    const entry = refs.get(tile) ?? {};
    // Whole metres, rounded outward, so the stored box always contains the feature.
    (entry[layer] ??= []).push([featureId, owner, [Math.floor(bounds[0]), Math.floor(bounds[1]), Math.ceil(bounds[2]), Math.ceil(bounds[3])]]);
    refs.set(tile, entry);
  };
  for (const { item, owner } of ownedBuildings) {
    const bounds = boundsOfPolygonal(item.footprint);
    for (const t of coveredLocalTiles(bounds)) addRef(t.id, "buildings", item.id, owner, bounds);
  }
  for (const { item, owner } of ownedStreets) {
    const line = streetLocal.get(item.id)!;
    const bounds = boundsOfLine(line);
    for (const t of coveredLocalTiles(bounds)) if (lineIntersectsRect(line, t.rect)) addRef(t.id, "streets", item.id, owner, bounds);
  }
  for (const { item, owner } of ownedWater) {
    const bounds = boundsOfPolygonal(item.geometry);
    for (const t of coveredLocalTiles(bounds)) addRef(t.id, "waterBodies", item.id, owner, bounds);
  }
  for (const { item, owner } of ownedParks) {
    const bounds = boundsOfPolygonal(item.geometry);
    for (const t of coveredLocalTiles(bounds)) addRef(t.id, "parkProperties", item.id, owner, bounds);
  }

  /* ----------------------------------------------------------- local tiles */
  const landLocal = landCoverByTile(sources.nlcd.data, coverage, "local");
  const landContext = landCoverByTile(sources.nlcd.data, coverage, "context");
  const group = <T>(items: Array<{ item: T; owner: string }>) => {
    const map = new Map<string, T[]>();
    for (const { item, owner } of items) {
      const list = map.get(owner);
      if (list) list.push(item);
      else map.set(owner, [item]);
    }
    return map;
  };
  const buildingsByTile = group(ownedBuildings);
  const streetsByTile = group(ownedStreets);
  const waterByTile = group(ownedWater);
  const parksByTile = group(ownedParks);
  const treesByTile = group(ownedTrees);
  const nodesByTile = group([...graph.nodes.values()].map((n) => ({ item: n, owner: nodeOwner.get(n.id)! })));
  const edgesByTile = group(graph.edges.map((e) => ({ item: e, owner: edgeOwner.get(e.id)! })));
  const sfNodesByTile = group(surface.nodes.map((n) => ({ item: n, owner: surfaceNodeOwner.get(n.id)! })));
  const sfEdgesByTile = group(surface.edges.map((e) => ({ item: e, owner: surfaceEdgeOwner(e) })));

  const tiles = new Map<string, SubstrateTile>();
  for (const [ix, iy] of localKeys) {
    const id = tileId("local", ix, iy);
    const tileRect = tileBoundsM("local", ix, iy);
    const ownNodes = new Set((nodesByTile.get(id) ?? []).map((n) => n.id));
    const ownEdges = (edgesByTile.get(id) ?? []) as StreetGraphEdge[];
    const externalNodes = uniquePairs(
      ownEdges.flatMap((e) => [e.from, e.to]).filter((n) => !ownNodes.has(n)).map((n): [string, string] => [n, nodeOwner.get(n)!]),
    );
    const ownSfNodes = new Set((sfNodesByTile.get(id) ?? []).map((n) => n.id));
    const ownSfEdges = sfEdgesByTile.get(id) ?? [];
    const sfExternal = uniquePairs(
      ownSfEdges.flatMap((e) => [e.from, e.to]).filter((n) => !ownSfNodes.has(n)).map((n): [string, string] => [n, surfaceNodeOwner.get(n)!]),
    );
    const symbols = mask.tileSymbols("local", ix, iy, config.water.localCellM);
    const waterCells = symbols.filter((s) => s === "W").length;
    const landCells = symbols.filter((s) => s === "L").length;
    const cellArea = config.water.localCellM * config.water.localCellM;
    const tileRefs = refs.get(id) ?? {};
    const tile: LocalTile = {
      schemaVersion: SUBSTRATE_SCHEMA_VERSION,
      tileId: id,
      level: "local",
      grid: { sizeM: SUBSTRATE_LEVELS.local.tileSizeM, ix, iy },
      bounds: tileBoundsLonLat("local", ix, iy),
      crs: SUBSTRATE_CRS,
      coverage: tileCoverage(tileRect, coverage),
      refs: Object.fromEntries(Object.keys(tileRefs).sort().map((layer) => [layer, uniqueRefs(tileRefs[layer])])),
      layers: {
        buildings: buildingsByTile.get(id) ?? [],
        streets: (streetsByTile.get(id) ?? []).map((s): StreetSegmentFeature => ({ ...s, nodes: graph.segmentNodes.get(s.id) ?? null })),
        streetGraph: {
          nodes: (nodesByTile.get(id) ?? []).map((n) => stripXY(n) as StreetGraphNode).sort((a, b) => byString(a.id, b.id)),
          edges: ownEdges,
          externalNodes,
        },
        pedestrianGraph: {
          edgeIds: ownEdges.filter((e) => access.get(e.id) === null).map((e) => e.id),
          excluded: ownEdges.filter((e) => access.get(e.id) !== null).map((e): [string, string] => [e.id, access.get(e.id)!]),
        },
        surfaceFlowGraph: {
          nodes: (sfNodesByTile.get(id) ?? []).map(({ xy: _xy, streetNodeId: _s, ...n }) => n as SurfaceFlowNode),
          edges: ownSfEdges.map(({ ownerXY: _o, ownerStreetEdgeId: _e, ...e }) => e as SurfaceFlowEdge),
          externalNodes: sfExternal,
        },
        elevation: lattice.tile("local", ix, iy, config.elevation.localCellM),
        water: {
          mask: { cellSizeM: config.water.localCellM, rows: Math.sqrt(symbols.length), cols: Math.sqrt(symbols.length), rle: encodeRle(symbols) },
          landCells,
          waterCells,
          noDataCells: symbols.length - landCells - waterCells,
          openWaterAreaM2: waterCells * cellArea,
          role: "receiving-water",
          bodies: waterByTile.get(id) ?? [],
        },
        landCover: landLocal.get(id) ?? null,
        vegetation: { trees: treesByTile.get(id) ?? [], parkProperties: parksByTile.get(id) ?? [] },
      },
    };
    tiles.set(id, tile);
  }

  /* --------------------------------------------------------- context tiles */
  const contextOf = (xy: XY) => {
    const [ix, iy] = tileIndexForPoint("context", xy);
    return tileId("context", ix, iy);
  };
  for (const key of tilesIntersectingM("context", coverage)) {
    const id = tileId("context", key.ix, key.iy);
    const rect = tileBoundsM("context", key.ix, key.iy);
    const symbols = mask.tileSymbols("context", key.ix, key.iy, config.water.contextCellM);
    const waterCells = symbols.filter((s) => s === "W").length;
    const landCells = symbols.filter((s) => s === "L").length;
    const tile: ContextTile = {
      schemaVersion: SUBSTRATE_SCHEMA_VERSION,
      tileId: id,
      level: "context",
      grid: { sizeM: SUBSTRATE_LEVELS.context.tileSizeM, ix: key.ix, iy: key.iy },
      bounds: tileBoundsLonLat("context", key.ix, key.iy),
      crs: SUBSTRATE_CRS,
      coverage: tileCoverage(rect, coverage),
      refs: {},
      layers: {
        buildings: ownedBuildings
          .filter((b) => contextOf(b.xy) === id)
          .map((b) => contextBuilding(b.item, config.context.buildingToleranceM))
          .filter((b): b is NonNullable<typeof b> => b !== null),
        streets: ownedStreets.filter((s) => s.item.physical && contextOf(s.xy) === id).map((s) => contextStreet({ ...s.item, nodes: null }, config.context.streetToleranceM)),
        elevation: lattice.tile("context", key.ix, key.iy, config.elevation.contextCellM),
        water: {
          mask: { cellSizeM: config.water.contextCellM, rows: Math.sqrt(symbols.length), cols: Math.sqrt(symbols.length), rle: encodeRle(symbols) },
          landCells,
          waterCells,
          noDataCells: symbols.length - landCells - waterCells,
          openWaterAreaM2: waterCells * config.water.contextCellM * config.water.contextCellM,
          role: "receiving-water",
          bodies: [],
        },
        landCover: landContext.get(id) ?? null,
        vegetation: {
          treeCount: ownedTrees.filter((t) => contextOf(t.xy) === id).length,
          parkPropertyCount: ownedParks.filter((p) => contextOf(p.xy) === id).length,
        },
      },
    };
    tiles.set(id, tile);
  }

  /* ------------------------------------------------------ hashes and texts */
  const orderedIds = [...tiles.keys()].sort(compareTileIds);
  const orderedTiles = new Map(orderedIds.map((id) => [id, tiles.get(id)!]));
  const texts = new Map<string, string>();
  const tileHashes: Record<string, string> = {};
  const tileEntries: Record<string, TileEntry> = {};
  for (const [id, tile] of orderedTiles) {
    const text = serializeTile(tile);
    texts.set(id, text);
    tileHashes[id] = contentHash(tile);
    tileEntries[id] = { level: tile.level, path: tilePath(id), bytes: textBytes(text), coverage: tile.coverage, features: featureCounts(tile) };
  }

  /* ------------------------------------------------------------- manifest */
  const countAt = (level: SubstrateLevel, count: (tile: SubstrateTile) => number) =>
    [...orderedTiles.values()].filter((t) => t.level === level).reduce((sum, t) => sum + count(t), 0);
  const layers = layerManifests({
    countAt,
    buildings: buildings.stats,
    streets: streets.stats,
    waterBodies: waterBodies.stats,
    trees: trees.stats,
    parks: parks.stats,
    graph: graph.stats,
    surface: surface.stats,
    outside,
    config,
  });
  const manifest: UrbanSubstrateManifest = {
    schemaVersion: SUBSTRATE_SCHEMA_VERSION,
    substrateVersion: config.label,
    title: config.title,
    generatedAt: meta.generatedAt,
    nonAuthoritative: ["generatedAt", "compiler.commit"],
    bounds: coverageBBox(config),
    crs: SUBSTRATE_CRS,
    grid: {
      id: SUBSTRATE_GRID.id,
      projection: `local equirectangular: x = (lon − ${SUBSTRATE_GRID.originLon})·${SUBSTRATE_GRID.metresPerDegLon}, y = (lat − ${SUBSTRATE_GRID.originLat})·${SUBSTRATE_GRID.metresPerDegLat} (metres); geometry stored as ${SUBSTRATE_CRS} rounded to 1e-${COORDINATE_DECIMALS}°`,
      origin: [SUBSTRATE_GRID.originLon, SUBSTRATE_GRID.originLat],
      metresPerDegree: [SUBSTRATE_GRID.metresPerDegLon, SUBSTRATE_GRID.metresPerDegLat],
      referenceLatitude: SUBSTRATE_GRID.referenceLatitude,
      maxScaleError: SUBSTRATE_GRID.maxScaleError,
    },
    tileSizeMeters: SUBSTRATE_LEVELS.local.tileSizeM,
    levels: {
      local: { tileSizeMeters: SUBSTRATE_LEVELS.local.tileSizeM, description: SUBSTRATE_LEVELS.local.description },
      context: { tileSizeMeters: SUBSTRATE_LEVELS.context.tileSizeM, description: SUBSTRATE_LEVELS.context.description },
    },
    sources: sourceRecords,
    compiler: { name: SUBSTRATE_COMPILER.name, version: SUBSTRATE_COMPILER.version, commit: meta.commit, configHash: contentHash(config), config },
    layers,
    tiles: tileEntries,
    validation: { errors: 0, warnings: 0, checks: [] },
    hashes: { manifest: "", tiles: tileHashes },
  };
  manifest.validation = validateSubstrate(manifest, orderedTiles, texts).summary;
  manifest.hashes.manifest = computeManifestHash(manifest);
  return { manifest, tiles: orderedTiles, texts };
}

/* ---------------------------------------------------------------- helpers */

function uniquePairs(pairs: Array<[string, string]>): Array<[string, string]> {
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  for (const pair of pairs) {
    const key = `${pair[0]}\u0000${pair[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(pair);
    }
  }
  return out.sort(byFirst);
}

function uniqueRefs(refs: TileRef[]): TileRef[] {
  const seen = new Set<string>();
  const out: TileRef[] = [];
  for (const ref of refs) {
    const key = `${ref[0]}\u0000${ref[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  }
  return out.sort((a, b) => byString(a[0], b[0]) || byString(a[1], b[1]));
}

function boundsOfLine(line: XY[]): RectM {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of line) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function boundsOfPolygonal(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): RectM {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
  return boundsOfLine(polygons.flatMap((polygon) => positionsToLocal(polygon[0])));
}

function tileCoverage(rect: RectM, coverage: RectM) {
  const area = (rect[2] - rect[0]) * (rect[3] - rect[1]);
  const fraction = rectOverlapArea(rect, coverage) / area;
  return { status: fraction >= 1 ? ("complete" as const) : fraction > 0 ? ("partial" as const) : ("none" as const), coveredFraction: Math.round(fraction * 1e4) / 1e4 };
}

export function featureCounts(tile: SubstrateTile): Record<string, number> {
  if (tile.level === "local") {
    const l = tile.layers;
    return {
      buildings: l.buildings.length,
      streets: l.streets.length,
      streetNodes: l.streetGraph.nodes.length,
      streetEdges: l.streetGraph.edges.length,
      surfaceFlowNodes: l.surfaceFlowGraph.nodes.length,
      surfaceFlowEdges: l.surfaceFlowGraph.edges.length,
      trees: l.vegetation.trees.length,
      parkProperties: l.vegetation.parkProperties.length,
      waterBodies: l.water.bodies.length,
    };
  }
  return {
    buildings: tile.layers.buildings.length,
    streets: tile.layers.streets.length,
    trees: tile.layers.vegetation.treeCount,
    parkProperties: tile.layers.vegetation.parkPropertyCount,
  };
}

function layerManifests(input: {
  countAt: (level: SubstrateLevel, count: (tile: SubstrateTile) => number) => number;
  buildings: ReturnType<typeof normalizeBuildings>["stats"];
  streets: ReturnType<typeof normalizeStreets>["stats"];
  waterBodies: ReturnType<typeof normalizeWaterBodies>["stats"];
  trees: ReturnType<typeof normalizeTrees>["stats"];
  parks: ReturnType<typeof normalizeParks>["stats"];
  graph: ReturnType<typeof buildStreetGraph>["stats"];
  surface: Record<string, number>;
  outside: Record<string, number>;
  config: SubstrateCompilerConfig;
}): Record<LayerId, LayerManifest> {
  const { countAt, config } = input;
  const local = (count: (tile: LocalTile) => number) => countAt("local", (t) => (t.level === "local" ? count(t) : 0));
  const context = (count: (tile: ContextTile) => number) => countAt("context", (t) => (t.level === "context" ? count(t) : 0));
  const flatten = (prefix: string, record: Record<string, number>) => Object.fromEntries(Object.entries(record).map(([k, v]) => [`${prefix}${k}`, v]));
  const sortKeys = (record: Record<string, number>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => byString(a, b)));
  return {
    buildings: {
      id: "buildings",
      title: "Building footprints",
      evidence: "measured",
      geometry: "Polygon / MultiPolygon footprints (EPSG:4326)",
      sources: [BUILDINGS_SOURCE, PLUTO_SOURCE],
      attributes: BUILDING_ATTRIBUTES,
      transformations: [
        "parse Socrata strings to numbers; feet to metres",
        "identify by DOITT feature id (BIN where no DOITT id; dummy BINs are not identifiers)",
        "round coordinates to 1e-7°, drop repeated vertices, close and orient rings",
        "flag self-intersections without repairing them",
        "join PLUTO tax-lot attributes by BBL",
        "assign each footprint to the local tile containing its area-weighted centroid; reference it from every other tile its bounds touch",
        `context level: outer rings Douglas–Peucker simplified at ${config.context.buildingToleranceM} m; height and area kept`,
      ],
      representation: { local: "full footprint and all attributes", context: "simplified outer rings, height and area" },
      counts: { local: local((t) => t.layers.buildings.length), context: context((t) => t.layers.buildings.length) },
      missing: sortKeys(input.buildings.missing),
      summary: sortKeys({ input: input.buildings.input, kept: input.buildings.kept, outsideCoverage: input.outside.buildings, ...flatten("dropped.", input.buildings.dropped), ...flatten("issue.", input.buildings.issues) }),
      caveats: [
        "Footprints meet ASPRS Class 1 (±2 ft) where photogrammetric; manually digitised ones are less accurate.",
        "Roof plan area is the footprint area; roof height is above ground, not above sea level.",
        "PLUTO land use and floors describe the tax lot, not the individual building.",
      ],
    },
    streets: {
      id: "streets",
      title: "Street centrelines and modelled surfaces",
      evidence: "measured",
      geometry: "LineString centrelines; Polygon modelled surfaces",
      sources: [STREETS_SOURCE],
      attributes: STREET_ATTRIBUTES,
      transformations: [
        "join contiguous MultiLineString parts; round coordinates to 1e-7°",
        "map CSCL codes (rw_type, trafdir, status) to labels; feet to metres",
        "mark segments not on the ground (paper streets, non-physical segments, ferry routes)",
        "offset centrelines by half the recorded width to model a street surface where the width is known",
        "assign each segment to the tile containing its length midpoint; reference it from every other tile it crosses",
        `context level: Douglas–Peucker at ${config.context.streetToleranceM} m; class and width kept; physical segments only`,
      ],
      representation: { local: "full centrelines, attributes and modelled surfaces", context: "simplified physical centrelines with class and width" },
      counts: { local: local((t) => t.layers.streets.length), context: context((t) => t.layers.streets.length) },
      missing: sortKeys(input.streets.missing),
      summary: sortKeys({ input: input.streets.input, kept: input.streets.kept, outsideCoverage: input.outside.streets, ...flatten("dropped.", input.streets.dropped), ...flatten("issue.", input.streets.issues) }),
      caveats: [
        "Modelled surfaces ignore medians, curb returns and junction geometry; they are not the planimetric roadbed.",
        "Widths are unknown for a large share of segments and are never filled.",
      ],
    },
    streetGraph: {
      id: "streetGraph",
      title: "Street graph",
      evidence: "modeled",
      geometry: "nodes (intersections, endpoints, continuations) and edges (physical street segments)",
      sources: [STREETS_SOURCE, ELEVATION_SOURCE],
      attributes: [
        { name: "nodes", unit: null, evidence: "modeled", source: "derived", field: null, transform: `segment endpoints merged within ${config.graph.nodeMergeToleranceM} m on the same CSCL level` },
        { name: "elevationM", unit: "m", evidence: "modeled", source: ELEVATION_SOURCE, field: null, transform: "bilinear sample of the elevation lattice at at-grade nodes; null near artefacts or not at grade" },
        { name: "slope", unit: "m/m", evidence: "modeled", source: "derived", field: null, transform: "(to − from elevation) / length for at-grade edges" },
      ],
      transformations: ["endpoint keys from rounded positions and level codes", "union-find merge within tolerance", "degree and kind from compiled edges", "boundary flag where the coverage truncates topology", "node owned by its tile (boundary nodes outside coverage by their first edge's tile); edge owned with its segment"],
      representation: { local: "nodes and edges with external-node references", context: "absent" },
      counts: { local: local((t) => t.layers.streetGraph.edges.length), context: 0 },
      missing: {},
      summary: sortKeys({ ...input.graph, nodes: local((t) => t.layers.streetGraph.nodes.length), nodesWithoutElevation: local((t) => t.layers.streetGraph.nodes.filter((n) => n.elevationM === null).length) }),
      caveats: ["Topology only: no turn restrictions, signals or lane connectivity.", "Traffic direction assumes the address range runs from the first to the last vertex."],
    },
    pedestrianGraph: {
      id: "pedestrianGraph",
      title: "Pedestrian access (centreline level)",
      evidence: "modeled",
      geometry: "subset of street-graph edges",
      sources: [STREETS_SOURCE],
      attributes: [{ name: "excluded", unit: null, evidence: "modeled", source: "derived", field: "nonped, rw_type, status", transform: "excluded with a reason: not physical, highway/ramp/tunnel, or a non-empty nonped flag" }],
      transformations: ["classify each street-graph edge as usable by pedestrians or excluded, with the reason"],
      representation: { local: "edge ids and exclusions", context: "absent" },
      counts: { local: local((t) => t.layers.pedestrianGraph.edgeIds.length), context: 0 },
      missing: {},
      summary: { excluded: local((t) => t.layers.pedestrianGraph.excluded.length) },
      caveats: ["Not sidewalk geometry: both sides of a street are one edge.", "nonped is undocumented in the published dictionary and is treated conservatively."],
    },
    surfaceFlowGraph: {
      id: "surfaceFlowGraph",
      title: "Surface-flow structure (experimental)",
      evidence: "modeled",
      geometry: "street nodes, terrain low points and open-water receivers with oriented links",
      sources: [STREETS_SOURCE, ELEVATION_SOURCE, SHORELINE_SOURCE],
      attributes: [{ name: "edges", unit: null, evidence: "modeled", source: "derived", field: null, transform: `street edges oriented downhill (flat below ${config.graph.flatSlope}); sinks within ${config.graph.receiverReachM} m of open water linked to it; terrain low points linked to the nearest street node within ${config.graph.lowPointSnapM} m` }],
      transformations: ["orient at-grade street edges by sampled elevation", "identify street-network sinks", "link sinks to open-water receivers", "detect strict terrain low points on land above 0 m", "link low points to nearby street nodes"],
      representation: { local: "nodes, edges and external-node references", context: "absent" },
      counts: { local: local((t) => t.layers.surfaceFlowGraph.edges.length), context: 0 },
      missing: {},
      summary: input.surface,
      caveats: SURFACE_FLOW_CAVEATS,
    },
    elevation: {
      id: "elevation",
      title: "Ground elevation",
      evidence: "measured",
      geometry: `north-up grids: ${config.elevation.localCellM} m (local), ${config.elevation.contextCellM} m (context)`,
      sources: [ELEVATION_SOURCE],
      attributes: ELEVATION_ATTRIBUTES,
      transformations: ["sample Terrarium at local cell centres (at fetch)", "store integer centimetres", "aggregate whole local cells for context"],
      representation: { local: `${config.elevation.localCellM} m cells`, context: `${config.elevation.contextCellM} m cells` },
      counts: { local: local((t) => (t.layers.elevation ? 1 : 0)), context: context((t) => (t.layers.elevation ? 1 : 0)) },
      missing: { tilesWithoutElevation: local((t) => (t.layers.elevation ? 0 : 1)) },
      summary: { artefactCells: local((t) => t.layers.elevation?.artefactCells ?? 0), nullCells: local((t) => t.layers.elevation?.valuesCm.filter((v) => v === null).length ?? 0) },
      caveats: [
        "Terrarium blends sources and includes bathymetry; shoreline artefacts far below sea level are kept and counted, not repaired.",
        "The app's storm routing still loads elevation itself; this layer is the substrate's own record and is not substituted into routed experiments.",
        "No synthetic or illustrative elevation is ever written into the substrate.",
      ],
    },
    landCover: {
      id: "landCover",
      title: "Reference land cover (NLCD 2021)",
      evidence: "reference",
      geometry: "per-tile class counts and reference shares",
      sources: [NLCD_SOURCE],
      attributes: LAND_COVER_ATTRIBUTES,
      transformations: ["assign 30 m cells to tiles by centre", "count classes; compute water, impervious and pervious shares"],
      representation: { local: "per-tile summary", context: "per-tile summary" },
      counts: { local: local((t) => (t.layers.landCover ? 1 : 0)), context: context((t) => (t.layers.landCover ? 1 : 0)) },
      missing: {},
      summary: { cells: local((t) => t.layers.landCover?.cells ?? 0) },
      caveats: [
        "A reference map with its own error, kept separate from the AI classification and never written into it.",
        "Buildings and pavement are not separable; epoch 2021.",
      ],
    },
    vegetation: {
      id: "vegetation",
      title: "Street trees and park properties",
      evidence: "measured",
      geometry: "tree points; park property polygons",
      sources: [TREES_SOURCE, PARKS_SOURCE],
      attributes: VEGETATION_ATTRIBUTES,
      transformations: ["round positions; inches to centimetres", "normalise park polygons", "assign trees by position and parks by centroid"],
      representation: { local: "trees and park properties", context: "counts only" },
      counts: { local: local((t) => t.layers.vegetation.trees.length), context: context((t) => t.layers.vegetation.treeCount) },
      missing: sortKeys(input.trees.missing),
      summary: sortKeys({ trees: input.trees.kept, treesOutsideCoverage: input.outside.trees, parkProperties: input.parks.kept, parksOutsideCoverage: input.outside.parkProperties, ...flatten("parkIssue.", input.parks.issues) }),
      caveats: ["Street trees only (2015 census), as points, not canopy.", "Park properties include paved plazas and playgrounds; they are not a vegetation map."],
    },
    water: {
      id: "water",
      title: "Open water and inland water bodies",
      evidence: "modeled",
      geometry: `land/water mask (${config.water.localCellM} m local, ${config.water.contextCellM} m context); inland water polygons`,
      sources: [SHORELINE_SOURCE, WATER_BODIES_SOURCE],
      attributes: WATER_ATTRIBUTES,
      transformations: ["fill shoreline-clipped borough land by even-odd scanline at cell centres", "everything else inside coverage is open water", "outside coverage is no-data, not water", "normalise inland water polygons"],
      representation: { local: "mask and inland water bodies", context: "mask only" },
      counts: { local: local((t) => t.layers.water.waterCells), context: context((t) => t.layers.water.waterCells) },
      missing: {},
      summary: sortKeys({ waterBodies: input.waterBodies.kept, waterBodiesOutsideCoverage: input.outside.waterBodies }),
      caveats: [
        "Open water is receiving water: it is never counted as retention or pervious area.",
        "The shoreline is a digitised boundary at an unspecified tide; New Jersey is not in the source and is no-data.",
      ],
    },
  };
}
