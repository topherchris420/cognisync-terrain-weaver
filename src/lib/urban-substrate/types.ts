import type { EvidenceStatus } from "@/lib/evidence/status";
import type { SubstrateLevel } from "./config";

/** [west, south, east, north] in WGS84 degrees. */
export type BBox = [number, number, number, number];
export type Position = [number, number];

/* ------------------------------------------------------------- provenance */

/**
 * One frozen public dataset. Everything needed to say where a substrate
 * value came from: who published it, which version, the exact query, when it
 * was retrieved, under which licence, and a hash of the records as frozen.
 */
export interface SourceRecord {
  sourceId: string;
  title: string;
  provider: string;
  /** Provider's dataset identifier (e.g. a Socrata 4×4 id), when it has one. */
  datasetId: string | null;
  url: string;
  /** The exact request that produced the frozen records. */
  query: string;
  /** Provider's last-update stamp at retrieval; null when the provider publishes none. */
  datasetVersion: string | null;
  retrievedAt: string;
  license: string;
  /** Epistemic status of the records themselves. */
  evidence: EvidenceStatus;
  /** CRS of the records as retrieved. */
  crs: string;
  recordCount: number;
  /** SHA-256 of the canonical frozen records. */
  contentHash: string;
  method: string;
  caveats: string[];
}

/** Provenance block every frozen substrate source fixture carries. */
export interface SourceFixtureProvenance {
  sourceId: string;
  source: string;
  provider: string;
  datasetId: string | null;
  url: string;
  query: string;
  datasetVersion: string | null;
  retrievedAt: string;
  license: string;
  evidence: string;
  crs: string;
  method: string;
  caveats: string[];
  contentHash: string;
}

export interface SourceFixture<T> {
  provenance: SourceFixtureProvenance;
  data: T;
}

/* ----------------------------------------------------------------- layers */

export type LayerId =
  | "buildings"
  | "streets"
  | "streetGraph"
  | "pedestrianGraph"
  | "surfaceFlowGraph"
  | "elevation"
  | "landCover"
  | "vegetation"
  | "water";

export interface AttributeSpec {
  name: string;
  unit: string | null;
  evidence: EvidenceStatus;
  /** Source id, or "derived" when computed by the compiler. */
  source: string;
  /** Source field the value is read from, when there is one. */
  field: string | null;
  /** How the stored value was obtained from the source value. */
  transform: string;
}

export interface LayerManifest {
  id: LayerId;
  title: string;
  /** Status of the layer's primary content. Attributes carry their own. */
  evidence: EvidenceStatus;
  geometry: string;
  sources: string[];
  attributes: AttributeSpec[];
  /** Ordered list of every transformation between source records and tiles. */
  transformations: string[];
  representation: Record<SubstrateLevel, string>;
  counts: Record<SubstrateLevel, number>;
  /** Features whose attribute is unknown (stored as null, never filled). */
  missing: Record<string, number>;
  /** Layer-specific counts (e.g. dropped records, merges, flagged geometry). */
  summary: Record<string, number>;
  caveats: string[];
}

/* --------------------------------------------------------------- features */

export interface BuildingLot {
  bbl: string;
  /** PLUTO land use of the tax lot; a lot attribute, not the building's own use. */
  landUse: string | null;
  landUseLabel: string | null;
  /** PLUTO floors of the tallest building on the lot. */
  lotNumFloors: number | null;
  buildingClass: string | null;
}

export interface BuildingFeature {
  id: string;
  sourceId: string;
  bin: string | null;
  doittId: string | null;
  footprint: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: Position;
  footprintAreaM2: number;
  /** Plan-view roof area, taken as the footprint area. */
  roofPlanAreaM2: number;
  roofHeightM: number | null;
  groundElevationM: number | null;
  constructionYear: number | null;
  featureCode: string | null;
  featureType: string | null;
  geometrySource: string | null;
  lot: BuildingLot | null;
  /** Problems found in the source geometry; never repaired silently. */
  geometryIssues: string[];
}

export interface ContextBuildingFeature {
  id: string;
  footprint: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  footprintAreaM2: number;
  roofHeightM: number | null;
}

export type RoadClass =
  | "street"
  | "highway"
  | "bridge"
  | "tunnel"
  | "boardwalk"
  | "path"
  | "step-street"
  | "driveway"
  | "ramp"
  | "alley"
  | "u-turn"
  | "non-physical"
  | "ferry-route"
  | "unknown";

export type TrafficDirection = "with-address-range" | "against-address-range" | "two-way" | "non-vehicular";

export interface StreetSegmentFeature {
  id: string;
  sourceId: string;
  physicalId: string | null;
  name: string | null;
  geometry: GeoJSON.LineString;
  lengthM: number;
  roadwayTypeCode: string | null;
  roadClass: RoadClass;
  /** Exists on the ground: constructed status and a physical roadway type. */
  physical: boolean;
  constructionStatus: string | null;
  widthM: number | null;
  trafficDirection: TrafficDirection | null;
  travelLanes: number | null;
  parkingLanes: number | null;
  /** Raw CSCL vertical level codes at the from and to ends (13 = at grade). */
  levelCodes: [string | null, string | null];
  pedestrianExcluded: boolean;
  /** Centreline offset by half the recorded width; null when the width is unknown. */
  surface: GeoJSON.Polygon | null;
  surfaceAreaM2: number | null;
  geometryIssues: string[];
  /** Street-graph nodes at the from and to ends; null when the segment is not in the graph. */
  nodes: [string, string] | null;
}

export interface ContextStreetFeature {
  id: string;
  geometry: GeoJSON.LineString;
  roadClass: RoadClass;
  widthM: number | null;
}

export type GraphNodeKind = "intersection" | "endpoint" | "continuation";

export interface StreetGraphNode {
  id: string;
  position: Position;
  kind: GraphNodeKind;
  degree: number;
  levelCode: string | null;
  /** Ground elevation sampled from the substrate elevation layer (modeled); null when not at grade. */
  elevationM: number | null;
  /**
   * The coverage edge truncates this node: it lies outside the coverage, or a
   * source segment meeting it was not compiled. Its degree and kind describe
   * the compiled graph only.
   */
  boundary: boolean;
}

export interface StreetGraphEdge {
  id: string;
  segmentId: string;
  from: string;
  to: string;
  lengthM: number;
  roadClass: RoadClass;
  trafficDirection: TrafficDirection | null;
  gradeSeparated: boolean;
  /** Rise over run from sampled ground elevation, from → to; null where not meaningful. */
  slope: number | null;
}

export interface TileGraph<N, E> {
  nodes: N[];
  edges: E[];
  /** Nodes referenced by this tile's edges but owned by another tile. */
  externalNodes: Array<[string, string]>;
}

export interface PedestrianGraphLayer {
  /** Street-graph edge ids that pedestrians may use, owned by this tile. */
  edgeIds: string[];
  /** Street-graph edge ids excluded for pedestrians, with the reason. */
  excluded: Array<[string, string]>;
}

export type SurfaceFlowNodeKind = "street-node" | "low-point" | "water-receiver";

export interface SurfaceFlowNode {
  id: string;
  kind: SurfaceFlowNodeKind;
  position: Position;
  elevationM: number | null;
}

/**
 * street-downhill: a street edge oriented from its higher to its lower end;
 * street-flat: a street edge flatter than the configured slope (unoriented);
 * sink-to-receiver: a street-network sink near open water, linked to it;
 * low-point-link: a terrain low point and its nearest at-grade street node,
 * oriented higher → lower.
 */
export type SurfaceFlowEdgeKind = "street-downhill" | "street-flat" | "sink-to-receiver" | "low-point-link";

export interface SurfaceFlowEdge {
  id: string;
  from: string;
  to: string;
  kind: SurfaceFlowEdgeKind;
  dropM: number | null;
  lengthM: number;
}

export interface ElevationLayerTile {
  sourceId: string;
  evidence: EvidenceStatus;
  cellSizeM: number;
  rows: number;
  cols: number;
  /** Row-major from the north row, integer centimetres; null where the source has no value. */
  valuesCm: Array<number | null>;
  verticalUnits: string;
  verticalDatum: string;
  interpolation: string;
  sourceResolution: string;
  /** "none": every value is from the source. Synthetic fill is never used in the substrate. */
  fallback: "none";
  minM: number | null;
  maxM: number | null;
  /** Cells far below sea level: source artefacts, counted and left unchanged. */
  artefactCells: number;
}

export interface WaterBodyFeature {
  id: string;
  sourceId: string;
  name: string | null;
  featureCode: string | null;
  featureType: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaM2: number;
  geometryIssues: string[];
}

export interface WaterLayerTile {
  /** Land/water mask from shoreline-clipped boundaries: L land, W open water, N outside source coverage. */
  mask: { cellSizeM: number; rows: number; cols: number; rle: string };
  landCells: number;
  waterCells: number;
  noDataCells: number;
  openWaterAreaM2: number;
  /** Open water receives runoff; it is never retention capacity. */
  role: "receiving-water";
  bodies: WaterBodyFeature[];
}

export interface LandCoverReferenceTile {
  sourceId: string;
  evidence: EvidenceStatus;
  /** Reference cells whose centres fall in this tile and inside coverage. */
  cells: number;
  classCounts: Record<string, number>;
  /** Shares of the reference cells (%): open water, mean imperviousness on land, remainder. */
  reference: { waterPct: number; imperviousPct: number; perviousPct: number } | null;
}

export interface TreeFeature {
  id: string;
  sourceId: string;
  position: Position;
  status: string | null;
  speciesCommon: string | null;
  dbhCm: number | null;
  health: string | null;
}

export interface ParkPropertyFeature {
  id: string;
  sourceId: string;
  name: string | null;
  typeCategory: string | null;
  subcategory: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaM2: number;
  geometryIssues: string[];
}

export interface VegetationLayerTile {
  trees: TreeFeature[];
  parkProperties: ParkPropertyFeature[];
}

/* ------------------------------------------------------------------ tiles */

export type TileRef = [featureId: string, ownerTileId: string, boundsM: [number, number, number, number]];

export interface TileCoverage {
  status: "complete" | "partial" | "none";
  /** Share of the tile inside the declared source coverage. */
  coveredFraction: number;
}

interface TileBase {
  schemaVersion: string;
  tileId: string;
  grid: { sizeM: number; ix: number; iy: number };
  bounds: BBox;
  crs: string;
  coverage: TileCoverage;
  /**
   * Features this tile intersects but does not own: [featureId, ownerTileId,
   * feature bounds in grid metres rounded outward]. The bounds let a loader
   * fetch an owner tile only when the feature touches the area it needs.
   */
  refs: Record<string, TileRef[]>;
}

export interface LocalTile extends TileBase {
  level: "local";
  layers: {
    buildings: BuildingFeature[];
    streets: StreetSegmentFeature[];
    streetGraph: TileGraph<StreetGraphNode, StreetGraphEdge>;
    pedestrianGraph: PedestrianGraphLayer;
    surfaceFlowGraph: TileGraph<SurfaceFlowNode, SurfaceFlowEdge>;
    elevation: ElevationLayerTile | null;
    water: WaterLayerTile;
    landCover: LandCoverReferenceTile | null;
    vegetation: VegetationLayerTile;
  };
}

export interface ContextTile extends TileBase {
  level: "context";
  layers: {
    buildings: ContextBuildingFeature[];
    streets: ContextStreetFeature[];
    elevation: ElevationLayerTile | null;
    water: Omit<WaterLayerTile, "bodies"> & { bodies: [] };
    landCover: LandCoverReferenceTile | null;
    vegetation: { treeCount: number; parkPropertyCount: number };
  };
}

export type SubstrateTile = LocalTile | ContextTile;

/* --------------------------------------------------------------- manifest */

export interface TileEntry {
  level: SubstrateLevel;
  path: string;
  bytes: number;
  coverage: TileCoverage;
  features: Record<string, number>;
}

export interface ValidationSummary {
  errors: number;
  warnings: number;
  checks: Array<{ id: string; label: string; severity: "error" | "warning"; passed: boolean; failures: number; detail: string }>;
}

export interface SubstrateCompilerConfig {
  /** Human label; recorded as the substrate version. */
  label: string;
  title: string;
  region: string;
  /**
   * Declared coverage, authoritative as LOCAL tile indices (inclusive). Source
   * records are fetched for exactly this area; nothing outside it is compiled.
   */
  coverageTiles: { ixMin: number; iyMin: number; ixMax: number; iyMax: number };
  elevation: { localCellM: number; contextCellM: number; artefactBelowM: number };
  water: { localCellM: number; contextCellM: number };
  graph: {
    /** Endpoints closer than this (and on the same level) are one node. */
    nodeMergeToleranceM: number;
    /** |rise/run| below this is treated as flat in the surface-flow graph. */
    flatSlope: number;
    /** A street sink connects to open water no farther than this. */
    receiverReachM: number;
    /** A terrain low point attaches to a street node no farther than this. */
    lowPointSnapM: number;
  };
  context: { buildingToleranceM: number; streetToleranceM: number };
  /** No randomness enters compilation; recorded so that claim is checkable. */
  randomness: "none";
}

export interface UrbanSubstrateManifest {
  schemaVersion: string;
  substrateVersion: string;
  title: string;
  /** Non-authoritative: excluded from the manifest hash. */
  generatedAt: string;
  nonAuthoritative: string[];
  bounds: BBox;
  crs: string;
  grid: {
    id: string;
    projection: string;
    origin: Position;
    metresPerDegree: [number, number];
    referenceLatitude: number;
    maxScaleError: number;
  };
  tileSizeMeters: number;
  levels: Record<SubstrateLevel, { tileSizeMeters: number; description: string }>;
  sources: SourceRecord[];
  compiler: {
    name: string;
    version: string;
    /** Non-authoritative: excluded from the manifest hash. */
    commit: string | null;
    configHash: string;
    config: SubstrateCompilerConfig;
  };
  layers: Record<LayerId, LayerManifest>;
  tiles: Record<string, TileEntry>;
  validation: ValidationSummary;
  hashes: { manifest: string; tiles: Record<string, string> };
}

export interface CompiledSubstrate {
  manifest: UrbanSubstrateManifest;
  /** Tile id → tile, in stable order. */
  tiles: Map<string, SubstrateTile>;
  /** Tile id → canonical JSON text, exactly as published. */
  texts: Map<string, string>;
}
