export const HYDROLOGY_MODEL_VERSION = "mannahatta-d8-surface-v2";
export const MAX_SIMULATION_AREA_KM2 = 50;

export const RESOLUTION_GRID = {
  low: 30,
  medium: 90,
  high: 180,
} as const;

export type SimulationResolution = keyof typeof RESOLUTION_GRID;
export type ScientificStatus =
  | "observed"
  | "derived"
  | "modeled"
  | "projected"
  | "speculative";

export interface HydrologyProvenance {
  sourceId: string;
  title: string;
  agency: string;
  url: string;
  observedAt?: string;
  accessedAt: string;
  spatialResolutionM?: number;
  crs?: string;
  license?: string;
  method?: string;
  confidence: "high" | "medium" | "low";
  status: ScientificStatus;
  caveats: string[];
}

export interface SimBBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface HydrologyStormDefinition {
  id: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  distribution: "uniform";
  resolution: SimulationResolution;
  includeDrainage: false;
  hash: string;
}

export interface HydrologyModifierCell {
  row: number;
  col: number;
  retentionFractionDelta: number;
  storageDeltaMm: number;
  roughnessDelta: number;
  calibrationProvenance?: HydrologyProvenance[];
}

export interface HydrologyModifierGrid {
  bbox: SimBBox;
  rows: number;
  cols: number;
  cells: HydrologyModifierCell[];
}

export interface SimulationSurfaceInput {
  id: "now" | "possible";
  surfaceHash: string;
  baselineLayerHash: string;
  modifiers: HydrologyModifierGrid;
  provenance: HydrologyProvenance[];
}

export interface SimulationRequestV2 {
  bbox: SimBBox;
  storm: HydrologyStormDefinition;
  surface: SimulationSurfaceInput;
  expectedElevationHash?: string;
}

export interface HydrologyInput {
  request: SimulationRequestV2;
  elevation: number[][];
  elevationProvenance: HydrologyProvenance;
  elevationStatus: "observed" | "illustrative";
}

export interface HydrologyFlowPath {
  points: [number, number][];
  volume_m3: number;
  velocity_mps: number;
}

export interface HydrologyRiskZone {
  polygon: [number, number][];
  level: "low" | "moderate" | "high" | "severe";
  affected_area_km2: number;
}

export interface HydrologyImpactPoint {
  location: [number, number];
  accumulated_volume_m3: number;
  flood_depth_m: number;
  risk_level: string;
}

export interface WaterBalance {
  rainfallM3: number;
  infiltratedM3: number;
  storedM3: number;
  runoffM3: number;
  closureErrorM3: number;
}

export interface SimulationResponseV2 {
  flow_paths: HydrologyFlowPath[];
  risk_zones: HydrologyRiskZone[];
  impact_points: HydrologyImpactPoint[];
  metadata: {
    processed_area_km2: number;
    cells_analyzed: number;
    computation_time_ms: number;
  };
  stormHash: string;
  surfaceHash: string;
  modelVersion: string;
  elevationHash: string;
  elevationStatus: "observed" | "illustrative";
  waterBalance: WaterBalance;
  optimizationClaimsAllowed: boolean;
  warnings: string[];
  provenance: HydrologyProvenance[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function identity(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\S{3,200}$/.test(value) ||
    value.trim() !== value
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function validateProvenance(
  value: unknown,
  label: string
): HydrologyProvenance[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} requires provenance.`);
  }
  for (const [index, item] of value.entries()) {
    const candidate = record(item, `${label}[${index}]`);
    stringValue(candidate.sourceId, `${label}[${index}].sourceId`);
    stringValue(candidate.title, `${label}[${index}].title`);
    stringValue(candidate.agency, `${label}[${index}].agency`);
    stringValue(candidate.url, `${label}[${index}].url`);
    stringValue(candidate.accessedAt, `${label}[${index}].accessedAt`);
    if (!["high", "medium", "low"].includes(String(candidate.confidence))) {
      throw new Error(`${label}[${index}].confidence is invalid.`);
    }
    if (
      !["observed", "derived", "modeled", "projected", "speculative"].includes(
        String(candidate.status)
      )
    ) {
      throw new Error(`${label}[${index}].status is invalid.`);
    }
    if (
      !Array.isArray(candidate.caveats) ||
      !candidate.caveats.every((caveat) => typeof caveat === "string")
    ) {
      throw new Error(`${label}[${index}].caveats is invalid.`);
    }
  }
  return value as HydrologyProvenance[];
}

export function bboxAreaKm2(bbox: SimBBox): number {
  const latKm = (bbox.north - bbox.south) * 111;
  const midpoint = (bbox.north + bbox.south) / 2;
  const lngKm =
    (bbox.east - bbox.west) *
    111 *
    Math.cos((midpoint * Math.PI) / 180);
  return latKm * lngKm;
}

function validateBBox(value: unknown): SimBBox {
  const candidate = record(value, "bbox");
  const bbox: SimBBox = {
    north: finite(candidate.north, "bbox.north"),
    south: finite(candidate.south, "bbox.south"),
    east: finite(candidate.east, "bbox.east"),
    west: finite(candidate.west, "bbox.west"),
  };
  if (
    bbox.north <= bbox.south ||
    bbox.east <= bbox.west ||
    bbox.north > 90 ||
    bbox.south < -90 ||
    bbox.east > 180 ||
    bbox.west < -180
  ) {
    throw new Error("bbox coordinates are invalid.");
  }
  const area = bboxAreaKm2(bbox);
  if (!Number.isFinite(area) || area > MAX_SIMULATION_AREA_KM2) {
    throw new Error(
      `Simulation area must be at most ${MAX_SIMULATION_AREA_KM2} km2.`
    );
  }
  return bbox;
}

function sameBBox(left: SimBBox, right: SimBBox): boolean {
  return (
    Math.abs(left.north - right.north) <= 1e-9 &&
    Math.abs(left.south - right.south) <= 1e-9 &&
    Math.abs(left.east - right.east) <= 1e-9 &&
    Math.abs(left.west - right.west) <= 1e-9
  );
}

export function validateSimulationRequest(
  value: unknown
): SimulationRequestV2 {
  const candidate = record(value, "simulation request");
  const bbox = validateBBox(candidate.bbox);
  const storm = record(candidate.storm, "storm");
  identity(storm.id, "storm id");
  identity(storm.hash, "storm hash");
  const rainfallDepthMm = finite(
    storm.rainfallDepthMm,
    "storm rainfall depth"
  );
  const durationMinutes = finite(
    storm.durationMinutes,
    "storm duration"
  );
  if (rainfallDepthMm <= 0 || durationMinutes <= 0) {
    throw new Error("Storm depth and duration must be positive.");
  }
  if (storm.distribution !== "uniform") {
    throw new Error("Only uniform storm distribution is supported.");
  }
  if (
    typeof storm.resolution !== "string" ||
    !(storm.resolution in RESOLUTION_GRID)
  ) {
    throw new Error("Storm resolution is invalid.");
  }
  if (storm.includeDrainage !== false) {
    throw new Error("Drainage is not implemented; includeDrainage must be false.");
  }

  const surface = record(candidate.surface, "surface");
  if (surface.id !== "now" && surface.id !== "possible") {
    throw new Error("Surface id must be now or possible.");
  }
  identity(surface.surfaceHash, "surface hash");
  identity(surface.baselineLayerHash, "baseline layer hash");
  validateProvenance(surface.provenance, "surface provenance");
  if (candidate.expectedElevationHash !== undefined) {
    identity(candidate.expectedElevationHash, "expected elevation hash");
  }

  const modifiers = record(surface.modifiers, "surface modifiers");
  const modifierBBox = validateBBox(modifiers.bbox);
  if (!sameBBox(bbox, modifierBBox)) {
    throw new Error("Surface modifier bbox must match the simulation bbox.");
  }
  const rows = finite(modifiers.rows, "surface modifier rows");
  const cols = finite(modifiers.cols, "surface modifier cols");
  const expectedSize =
    RESOLUTION_GRID[storm.resolution as SimulationResolution];
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows !== expectedSize ||
    cols !== expectedSize
  ) {
    throw new Error(
      `Surface modifier dimensions must be ${expectedSize} by ${expectedSize}.`
    );
  }
  if (!Array.isArray(modifiers.cells)) {
    throw new Error("Surface modifier cells must be an array.");
  }
  const seen = new Set<string>();
  for (const [index, item] of modifiers.cells.entries()) {
    const cell = record(item, `surface modifier cell ${index}`);
    const row = finite(cell.row, `surface modifier cell ${index} row`);
    const col = finite(cell.col, `surface modifier cell ${index} col`);
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      col < 0 ||
      row >= rows ||
      col >= cols
    ) {
      throw new Error(`Surface modifier cell ${index} is out of bounds.`);
    }
    const key = `${row}:${col}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate surface modifier cell at ${key}.`);
    }
    seen.add(key);
    finite(
      cell.retentionFractionDelta,
      `surface modifier cell ${index} retention`
    );
    const storage = finite(
      cell.storageDeltaMm,
      `surface modifier cell ${index} storage`
    );
    const roughness = finite(
      cell.roughnessDelta,
      `surface modifier cell ${index} roughness`
    );
    if (storage < 0 || roughness < 0) {
      throw new Error("Storage and roughness modifiers cannot be negative.");
    }
    if (storage !== 0 || roughness !== 0) {
      validateProvenance(
        cell.calibrationProvenance,
        `surface modifier cell ${index} calibration provenance`
      );
    }
  }

  return value as SimulationRequestV2;
}

function coordinate(value: unknown, label: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${label} must be a coordinate pair.`);
  }
  return [finite(value[0], `${label}[0]`), finite(value[1], `${label}[1]`)];
}

export function validateSimulationResponse(
  value: unknown
): SimulationResponseV2 {
  const candidate = record(value, "simulation response");
  identity(candidate.stormHash, "response storm hash");
  identity(candidate.surfaceHash, "response surface hash");
  identity(candidate.modelVersion, "response model version");
  identity(candidate.elevationHash, "response elevation hash");
  if (
    candidate.elevationStatus !== "observed" &&
    candidate.elevationStatus !== "illustrative"
  ) {
    throw new Error("response elevation status is invalid.");
  }
  if (
    !Array.isArray(candidate.flow_paths) ||
    !Array.isArray(candidate.risk_zones) ||
    !Array.isArray(candidate.impact_points)
  ) {
    throw new Error("Simulation response geometry arrays are invalid.");
  }
  for (const [index, item] of candidate.flow_paths.entries()) {
    const path = record(item, `flow path ${index}`);
    if (
      !Array.isArray(path.points) ||
      path.points.length < 2
    ) {
      throw new Error(`flow path ${index} requires at least two points.`);
    }
    path.points.forEach((point, pointIndex) =>
      coordinate(point, `flow path ${index} point ${pointIndex}`)
    );
    if (
      finite(path.volume_m3, `flow path ${index} volume`) < 0 ||
      finite(path.velocity_mps, `flow path ${index} velocity`) < 0
    ) {
      throw new Error(`flow path ${index} values cannot be negative.`);
    }
  }
  for (const [index, item] of candidate.risk_zones.entries()) {
    const zone = record(item, `risk zone ${index}`);
    if (!Array.isArray(zone.polygon) || zone.polygon.length < 4) {
      throw new Error(`risk zone ${index} polygon is invalid.`);
    }
    zone.polygon.forEach((point, pointIndex) =>
      coordinate(point, `risk zone ${index} point ${pointIndex}`)
    );
    if (!["low", "moderate", "high", "severe"].includes(String(zone.level))) {
      throw new Error(`risk zone ${index} level is invalid.`);
    }
    if (finite(zone.affected_area_km2, `risk zone ${index} area`) < 0) {
      throw new Error(`risk zone ${index} area cannot be negative.`);
    }
  }
  for (const [index, item] of candidate.impact_points.entries()) {
    const impact = record(item, `impact point ${index}`);
    coordinate(impact.location, `impact point ${index} location`);
    if (
      finite(
        impact.accumulated_volume_m3,
        `impact point ${index} volume`
      ) < 0 ||
      finite(impact.flood_depth_m, `impact point ${index} depth`) < 0
    ) {
      throw new Error(`impact point ${index} values cannot be negative.`);
    }
    stringValue(impact.risk_level, `impact point ${index} risk level`);
  }
  const metadata = record(candidate.metadata, "response metadata");
  finite(metadata.processed_area_km2, "response processed area");
  finite(metadata.cells_analyzed, "response analyzed cells");
  finite(metadata.computation_time_ms, "response computation time");
  const balance = record(candidate.waterBalance, "response water balance");
  const rainfall = finite(balance.rainfallM3, "response rainfall");
  const infiltrated = finite(
    balance.infiltratedM3,
    "response infiltration"
  );
  const stored = finite(balance.storedM3, "response storage");
  const runoff = finite(balance.runoffM3, "response runoff");
  const reportedClosure = finite(
    balance.closureErrorM3,
    "response closure error"
  );
  if (
    rainfall < 0 ||
    infiltrated < 0 ||
    stored < 0 ||
    runoff < 0 ||
    reportedClosure < 0
  ) {
    throw new Error("response water balance values cannot be negative.");
  }
  const computedClosure = Math.abs(
    rainfall - infiltrated - stored - runoff
  );
  const tolerance = Math.max(1e-6, rainfall * 1e-6);
  if (
    computedClosure > tolerance ||
    reportedClosure > tolerance ||
    Math.abs(reportedClosure - computedClosure) > tolerance
  ) {
    throw new Error("response water balance does not close.");
  }
  if (typeof candidate.optimizationClaimsAllowed !== "boolean") {
    throw new Error("response optimization claim status is invalid.");
  }
  if (
    !Array.isArray(candidate.warnings) ||
    !candidate.warnings.every((warning) => typeof warning === "string")
  ) {
    throw new Error("response warnings are invalid.");
  }
  validateProvenance(candidate.provenance, "response provenance");
  return value as SimulationResponseV2;
}
