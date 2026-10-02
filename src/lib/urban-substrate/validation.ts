import { positionsToLocal, lineIntersectsRect, pointAlong, pointInRect } from "./geometry";
import { contentHash } from "./sha256";
import { hashTileText, isCompatibleSchema } from "./manifest";
import { missingSourceFields } from "./provenance";
import { toLocal } from "./projection";
import { contextTileOf, parseTileId, tileBoundsLonLat, tileBoundsM, tileId } from "./tile-id";
import { decodeRle } from "./layers/water";
import type { LocalTile, Position, SubstrateTile, UrbanSubstrateManifest, ValidationSummary } from "./types";

/**
 * Automated substrate validation. ERRORS are failures of the compiler or of
 * the substrate contract (identity, hashing, geometry the compiler produced,
 * ownership, references, provenance, cross-layer consistency). WARNINGS are
 * facts about the source data (self-intersecting source footprints,
 * elevation artefacts) that the substrate reports instead of hiding.
 */
export interface ValidationCheck {
  id: string;
  label: string;
  severity: "error" | "warning";
  passed: boolean;
  failures: number;
  detail: string;
}

export interface ValidationResult {
  summary: ValidationSummary;
  checks: ValidationCheck[];
}

class Check {
  failures = 0;
  examples: string[] = [];
  constructor(
    readonly id: string,
    readonly label: string,
    readonly severity: "error" | "warning",
  ) {}
  fail(message: string) {
    this.failures += 1;
    if (this.examples.length < 3) this.examples.push(message);
  }
  result(okDetail: string): ValidationCheck {
    return {
      id: this.id,
      label: this.label,
      severity: this.severity,
      passed: this.failures === 0,
      failures: this.failures,
      detail: this.failures === 0 ? okDetail : `${this.failures} failure(s), e.g. ${this.examples.join("; ")}`,
    };
  }
}

function polygonsOf(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Position[][][] {
  return (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
}

function positionsOf(tile: SubstrateTile): Position[] {
  const out: Position[] = [];
  const addPolygonal = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon | null) => {
    if (g) for (const polygon of polygonsOf(g)) for (const ring of polygon) out.push(...ring);
  };
  for (const b of tile.layers.buildings) addPolygonal(b.footprint);
  for (const s of tile.layers.streets) out.push(...(s.geometry.coordinates as Position[]));
  if (tile.level === "local") {
    const l = tile.layers;
    for (const b of l.buildings) out.push(b.centroid);
    for (const s of l.streets) addPolygonal(s.surface);
    for (const n of l.streetGraph.nodes) out.push(n.position);
    for (const n of l.surfaceFlowGraph.nodes) out.push(n.position);
    for (const w of l.water.bodies) addPolygonal(w.geometry);
    for (const t of l.vegetation.trees) out.push(t.position);
    for (const p of l.vegetation.parkProperties) addPolygonal(p.geometry);
  }
  return out;
}

const SOURCE_ISSUES = new Set(["source-self-intersection", "degenerate-ring", "zero-area-ring", "non-contiguous-parts"]);
const ROUNDING_ISSUES = new Set(["self-intersection-after-rounding"]);

export function validateSubstrate(manifest: UrbanSubstrateManifest, tiles: Map<string, SubstrateTile>, texts?: Map<string, string>): ValidationResult {
  const identity = new Check("tile-identity", "Tile ids, levels, bounds, CRS and schema are consistent", "error");
  const hashes = new Check("tile-hashes", "Every tile's content matches its recorded hash", "error");
  const coordinates = new Check("finite-coordinates", "All coordinates finite and within WGS84 range; bounds ordered", "error");
  const polygons = new Check("polygon-validity", "Rings closed, ≥ 4 positions, areas non-negative", "error");
  const ownership = new Check("feature-ownership", "Each feature lies in the tile that owns it", "error");
  const uniqueness = new Check("unique-ownership", "Each feature is owned by exactly one tile", "error");
  const references = new Check("tile-references", "Every reference names an existing tile that owns the feature", "error");
  const provenance = new Check("provenance", "Every layer, attribute and feature names a complete source record", "error");
  const elevation = new Check("elevation-coverage", "Elevation grids cover each covered tile at the declared resolution", "error");
  const water = new Check("water-not-retention", "Open water is receiving water and never counted as pervious land", "error");
  const context = new Check("context-consistency", "Context features are simplifications of compiled local features", "error");
  const sourceGeometry = new Check("source-geometry", "Source geometry problems (flagged, not repaired)", "warning");
  const rounding = new Check("rounding-touches", "Rings whose edges touch only after rounding to 1e-7° (source edges within ~1 cm; flagged, not repaired)", "warning");
  const artefacts = new Check("elevation-artefacts", "Elevation cells far below sea level (source artefacts, kept)", "warning");
  const misplaced = new Check("features-in-open-water", "Buildings or trees located on open-water cells of the shoreline mask", "warning");

  /* ------------------------------------------------------------ identity */
  if (!isCompatibleSchema(manifest.schemaVersion)) identity.fail(`manifest schema ${manifest.schemaVersion}`);
  const manifestIds = Object.keys(manifest.hashes.tiles);
  for (const id of manifestIds) if (!tiles.has(id)) identity.fail(`manifest lists missing tile ${id}`);
  const [bw, bs, be, bn] = manifest.bounds;
  if (!(bw < be && bs < bn)) coordinates.fail("manifest bounds not ordered");
  for (const [id, tile] of tiles) {
    const key = parseTileId(id);
    if (!key || tile.tileId !== id || key.level !== tile.level || key.ix !== tile.grid.ix || key.iy !== tile.grid.iy || key.sizeM !== tile.grid.sizeM) {
      identity.fail(`${id}: id, level or grid mismatch`);
      continue;
    }
    if (!(id in manifest.hashes.tiles) || !(id in manifest.tiles)) identity.fail(`${id}: not in manifest`);
    if (tile.crs !== manifest.crs) identity.fail(`${id}: CRS ${tile.crs} ≠ ${manifest.crs}`);
    if (tile.schemaVersion !== manifest.schemaVersion) identity.fail(`${id}: schema ${tile.schemaVersion}`);
    const expected = tileBoundsLonLat(key.level, key.ix, key.iy);
    if (expected.some((v, i) => v !== tile.bounds[i])) identity.fail(`${id}: bounds differ from its grid cell`);
    if (manifest.tiles[id] && manifest.tiles[id].level !== tile.level) identity.fail(`${id}: manifest level`);

    /* ---------------------------------------------------------- hashes */
    const recorded = manifest.hashes.tiles[id];
    if (recorded !== contentHash(tile)) hashes.fail(`${id}: content ≠ recorded hash`);
    const text = texts?.get(id);
    if (text !== undefined && hashTileText(text) !== recorded) hashes.fail(`${id}: published text ≠ recorded hash`);

    /* ----------------------------------------------------- coordinates */
    for (const [lon, lat] of positionsOf(tile)) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) coordinates.fail(`${id}: ${lon}, ${lat}`);
    }
  }

  /* ------------------------------------------------- per-feature checks */
  const owners: Record<string, Map<string, string>> = { buildings: new Map(), streets: new Map(), waterBodies: new Map(), parkProperties: new Map(), streetNodes: new Map(), surfaceNodes: new Map() };
  const own = (layer: string, featureId: string, tile: string) => {
    const previous = owners[layer].get(featureId);
    if (previous) uniqueness.fail(`${layer} ${featureId} in ${previous} and ${tile}`);
    else owners[layer].set(featureId, tile);
  };
  const sourceIds = new Set(manifest.sources.map((s) => s.sourceId));
  const ringCheck = (where: string, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null) => {
    if (!geometry) return;
    for (const polygon of polygonsOf(geometry)) {
      for (const ring of polygon) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (ring.length < 4 || first[0] !== last[0] || first[1] !== last[1]) polygons.fail(`${where}: open or short ring`);
      }
    }
  };
  const flagIssues = (featureId: string, issues: string[]) => {
    for (const issue of issues) {
      if (ROUNDING_ISSUES.has(issue)) rounding.fail(`${featureId}: ${issue}`);
      else if (SOURCE_ISSUES.has(issue)) sourceGeometry.fail(`${featureId}: ${issue}`);
    }
  };
  const localTiles = [...tiles.values()].filter((t): t is LocalTile => t.level === "local");
  const inTile = (tile: LocalTile, position: Position) => pointInRect(toLocal(position[0], position[1]), tileBoundsM("local", tile.grid.ix, tile.grid.iy));

  for (const tile of localTiles) {
    const id = tile.tileId;
    const rect = tileBoundsM("local", tile.grid.ix, tile.grid.iy);
    const l = tile.layers;
    for (const b of l.buildings) {
      own("buildings", b.id, id);
      ringCheck(b.id, b.footprint);
      if (!inTile(tile, b.centroid)) ownership.fail(`building ${b.id} centroid outside ${id}`);
      if (b.footprintAreaM2 < 0 || b.roofPlanAreaM2 < 0) polygons.fail(`${b.id}: negative area`);
      flagIssues(b.id, b.geometryIssues);
      if (!sourceIds.has(b.sourceId)) provenance.fail(`${b.id}: unknown source ${b.sourceId}`);
    }
    for (const s of l.streets) {
      own("streets", s.id, id);
      const line = positionsToLocal(s.geometry.coordinates as Position[]);
      if (!pointInRect(pointAlong(line, s.lengthM / 2), rect)) ownership.fail(`street ${s.id} midpoint outside ${id}`);
      if (!lineIntersectsRect(line, rect)) ownership.fail(`street ${s.id} does not touch ${id}`);
      if (s.lengthM < 0 || (s.surfaceAreaM2 !== null && s.surfaceAreaM2 < 0)) polygons.fail(`${s.id}: negative size`);
      ringCheck(`${s.id} surface`, s.surface);
      flagIssues(s.id, s.geometryIssues);
      if (!sourceIds.has(s.sourceId)) provenance.fail(`${s.id}: unknown source ${s.sourceId}`);
    }
    for (const n of l.streetGraph.nodes) {
      own("streetNodes", n.id, id);
      if (!n.boundary && !inTile(tile, n.position)) ownership.fail(`node ${n.id} outside ${id}`);
    }
    for (const n of l.surfaceFlowGraph.nodes) {
      own("surfaceNodes", n.id, id);
      if (n.kind === "low-point" && !inTile(tile, n.position)) ownership.fail(`low point ${n.id} outside ${id}`);
    }
    for (const w of l.water.bodies) {
      own("waterBodies", w.id, id);
      ringCheck(w.id, w.geometry);
      if (w.areaM2 < 0) polygons.fail(`${w.id}: negative area`);
      flagIssues(w.id, w.geometryIssues);
      if (!sourceIds.has(w.sourceId)) provenance.fail(`${w.id}: unknown source`);
    }
    for (const t of l.vegetation.trees) {
      if (!inTile(tile, t.position)) ownership.fail(`tree ${t.id} outside ${id}`);
      if (!sourceIds.has(t.sourceId)) provenance.fail(`${t.id}: unknown source`);
    }
    for (const p of l.vegetation.parkProperties) {
      own("parkProperties", p.id, id);
      ringCheck(p.id, p.geometry);
      if (p.areaM2 < 0) polygons.fail(`${p.id}: negative area`);
      flagIssues(p.id, p.geometryIssues);
      if (!sourceIds.has(p.sourceId)) provenance.fail(`${p.id}: unknown source`);
    }
  }

  /* ----------------------------------------------------- references */
  const layerOwner: Record<string, Map<string, string>> = {
    buildings: owners.buildings,
    streets: owners.streets,
    waterBodies: owners.waterBodies,
    parkProperties: owners.parkProperties,
  };
  for (const tile of localTiles) {
    for (const [layer, pairs] of Object.entries(tile.refs)) {
      for (const [featureId, ownerTile, bounds] of pairs) {
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0] > bounds[2] || bounds[1] > bounds[3]) references.fail(`${tile.tileId}: ${featureId} has invalid reference bounds`);
        if (!tiles.has(ownerTile)) references.fail(`${tile.tileId} → missing tile ${ownerTile}`);
        else if (layerOwner[layer]?.get(featureId) !== ownerTile) references.fail(`${tile.tileId}: ${layer} ${featureId} not owned by ${ownerTile}`);
        if (ownerTile === tile.tileId) references.fail(`${tile.tileId}: self-reference ${featureId}`);
      }
    }
    const g = tile.layers.streetGraph;
    const local = new Set(g.nodes.map((n) => n.id));
    const external = new Map(g.externalNodes);
    for (const [node, ownerTile] of g.externalNodes) if (owners.streetNodes.get(node) !== ownerTile) references.fail(`${tile.tileId}: external node ${node} not in ${ownerTile}`);
    for (const e of g.edges) for (const node of [e.from, e.to]) if (!local.has(node) && !external.has(node)) references.fail(`${tile.tileId}: edge ${e.id} → unknown node ${node}`);
    const edgeIds = new Set(g.edges.map((e) => e.id));
    for (const s of tile.layers.streets) {
      if (!s.nodes) continue;
      const edge = g.edges.find((e) => e.segmentId === s.id);
      if (!edge || edge.from !== s.nodes[0] || edge.to !== s.nodes[1]) references.fail(`${s.id}: nodes disagree with its graph edge`);
    }
    for (const e of [...tile.layers.pedestrianGraph.edgeIds, ...tile.layers.pedestrianGraph.excluded.map(([e]) => e)]) {
      if (!edgeIds.has(e)) references.fail(`${tile.tileId}: pedestrian edge ${e} not a street edge of this tile`);
    }
    const sf = tile.layers.surfaceFlowGraph;
    const sfLocal = new Set(sf.nodes.map((n) => n.id));
    const sfExternal = new Map(sf.externalNodes);
    for (const [node, ownerTile] of sf.externalNodes) if (owners.surfaceNodes.get(node) !== ownerTile) references.fail(`${tile.tileId}: external surface node ${node} not in ${ownerTile}`);
    for (const e of sf.edges) for (const node of [e.from, e.to]) if (!sfLocal.has(node) && !sfExternal.has(node)) references.fail(`${tile.tileId}: surface edge ${e.id} → unknown node ${node}`);
  }

  /* ----------------------------------------------------- provenance */
  for (const source of manifest.sources) {
    const missing = missingSourceFields(source);
    if (missing.length) provenance.fail(`${source.sourceId}: lacks ${missing.join(", ")}`);
  }
  for (const layer of Object.values(manifest.layers)) {
    if (layer.sources.length === 0) provenance.fail(`${layer.id}: no source`);
    for (const s of layer.sources) if (!sourceIds.has(s)) provenance.fail(`${layer.id}: unknown source ${s}`);
    for (const a of layer.attributes) if (a.source !== "derived" && !sourceIds.has(a.source)) provenance.fail(`${layer.id}.${a.name}: unknown source ${a.source}`);
  }

  /* --------------------------------------------------- cross-layer */
  for (const tile of tiles.values()) {
    const e = tile.layers.elevation;
    if (e && !sourceIds.has(e.sourceId)) provenance.fail(`${tile.tileId}: elevation source`);
    if (tile.layers.landCover && !sourceIds.has(tile.layers.landCover.sourceId)) provenance.fail(`${tile.tileId}: land-cover source`);
    if (tile.coverage.status === "complete") {
      if (!e) elevation.fail(`${tile.tileId}: no elevation`);
      else if (e.rows * e.cellSizeM !== tile.grid.sizeM || e.cols * e.cellSizeM !== tile.grid.sizeM || e.valuesCm.length !== e.rows * e.cols) elevation.fail(`${tile.tileId}: grid does not cover the tile`);
      else if (e.valuesCm.some((v) => v === null)) elevation.fail(`${tile.tileId}: gaps inside coverage`);
    }
    if (e && e.artefactCells > 0) artefacts.fail(`${tile.tileId}: ${e.artefactCells} cells`);

    const w = tile.layers.water;
    const cells = decodeRle(w.mask.rle);
    const count = (symbol: string) => cells.filter((c) => c === symbol).length;
    if (w.role !== "receiving-water") water.fail(`${tile.tileId}: water role ${w.role}`);
    if (cells.length !== w.mask.rows * w.mask.cols || count("W") !== w.waterCells || count("L") !== w.landCells || count("N") !== w.noDataCells) water.fail(`${tile.tileId}: mask counts`);
    if (w.openWaterAreaM2 !== w.waterCells * w.mask.cellSizeM * w.mask.cellSizeM) water.fail(`${tile.tileId}: open-water area`);
    const r = tile.layers.landCover?.reference;
    if (r && (Math.abs(r.waterPct + r.imperviousPct + r.perviousPct - 100) > 0.02 || r.perviousPct > 100 - r.waterPct + 0.01)) water.fail(`${tile.tileId}: reference shares count water as land`);

    if (tile.level === "local") {
      const rect = tileBoundsM("local", tile.grid.ix, tile.grid.iy);
      const symbolAt = (position: Position) => {
        const [x, y] = toLocal(position[0], position[1]);
        const col = Math.floor((x - rect[0]) / w.mask.cellSizeM);
        const row = Math.floor((rect[3] - y) / w.mask.cellSizeM);
        return cells[row * w.mask.cols + col];
      };
      for (const b of tile.layers.buildings) if (symbolAt(b.centroid) === "W") misplaced.fail(`building ${b.id}`);
      for (const t of tile.layers.vegetation.trees) if (symbolAt(t.position) === "W") misplaced.fail(`tree ${t.id}`);
    } else {
      for (const b of tile.layers.buildings) if (!owners.buildings.has(b.id)) context.fail(`context building ${b.id} has no local feature`);
      for (const s of tile.layers.streets) if (!owners.streets.has(s.id)) context.fail(`context street ${s.id} has no local feature`);
      for (const b of tile.layers.buildings) {
        // A context building sits in the context tile that contains its local owner tile.
        const key = parseTileId(owners.buildings.get(b.id) ?? "");
        if (key && tileId("context", ...contextTileOf(key.ix, key.iy)) !== tile.tileId) context.fail(`context building ${b.id} outside its owner's context tile`);
      }
    }
  }

  const checks = [
    identity.result(`${tiles.size} tiles`),
    hashes.result(`${tiles.size} tile hashes reproduced`),
    coordinates.result("all finite"),
    polygons.result("all rings valid"),
    ownership.result("every feature inside its owner tile"),
    uniqueness.result("no feature owned twice"),
    references.result("all references resolve"),
    provenance.result(`${manifest.sources.length} complete source records`),
    elevation.result("covered tiles fully gridded"),
    water.result("water receives; never retention"),
    context.result("context derived from local features"),
    sourceGeometry.result("none"),
    rounding.result("none"),
    artefacts.result("none"),
    misplaced.result("none"),
  ];
  const errors = checks.filter((c) => c.severity === "error").reduce((s, c) => s + c.failures, 0);
  const warnings = checks.filter((c) => c.severity === "warning").reduce((s, c) => s + c.failures, 0);
  return { summary: { errors, warnings, checks: checks.map(({ id, label, severity, passed, failures, detail }) => ({ id, label, severity, passed, failures, detail })) }, checks };
}
