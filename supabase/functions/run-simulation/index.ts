import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  HYDROLOGY_MODEL_VERSION,
  RESOLUTION_GRID,
  bboxAreaKm2,
  validateSimulationRequest,
  validateSimulationResponse,
  type HydrologyProvenance,
  type SimBBox,
  type SimulationRequestV2,
  type SimulationResolution,
  type SimulationResponseV2,
} from "../_shared/hydrology-contract.ts";
import { runHydrology } from "../_shared/hydrology-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SRTM_API = "https://portal.opentopography.org/API/globaldem";

interface LegacySimulationRequest {
  bbox: SimBBox;
  rainfall_mm: number;
  resolution?: SimulationResolution;
  include_drainage: boolean;
}

interface ElevationResult {
  elevation: number[][];
  status: "observed" | "illustrative";
  provenance: HydrologyProvenance;
}

type SupabaseClient = ReturnType<typeof createClient>;

function jsonError(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, details: details ?? null }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isV2Request(value: unknown): boolean {
  return isObject(value) && "storm" in value && "surface" in value;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateLegacyRequest(value: unknown): LegacySimulationRequest {
  if (!isObject(value) || !isObject(value.bbox)) {
    throw new Error("Invalid or missing bbox.");
  }
  const bbox = value.bbox;
  if (
    !finite(bbox.north) ||
    !finite(bbox.south) ||
    !finite(bbox.east) ||
    !finite(bbox.west) ||
    bbox.north <= bbox.south ||
    bbox.east <= bbox.west
  ) {
    throw new Error("Invalid bbox coordinates.");
  }
  const normalizedBBox: SimBBox = {
    north: bbox.north,
    south: bbox.south,
    east: bbox.east,
    west: bbox.west,
  };
  if (bboxAreaKm2(normalizedBBox) > 50) {
    throw new Error("Simulation area must be at most 50 km2.");
  }
  if (!finite(value.rainfall_mm) || value.rainfall_mm <= 0) {
    throw new Error("rainfall_mm must be a positive finite number.");
  }
  const resolution = value.resolution ?? "medium";
  if (
    typeof resolution !== "string" ||
    !(resolution in RESOLUTION_GRID)
  ) {
    throw new Error("Invalid simulation resolution.");
  }
  if (value.include_drainage !== false) {
    throw new Error(
      "Drainage is not implemented; include_drainage must be false."
    );
  }
  return {
    bbox: normalizedBBox,
    rainfall_mm: value.rainfall_mm,
    resolution: resolution as SimulationResolution,
    include_drainage: false,
  };
}

function fallbackElevation(size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from(
      { length: size },
      (_, col) =>
        100 -
        (row / size) * 50 +
        Math.sin(row * 0.5) * 5 +
        Math.cos(col * 0.3) * 3
    )
  );
}

function numericGrid(value: unknown): number[][] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((cell) => finite(cell))
    )
  ) {
    return null;
  }
  const width = value[0].length;
  if (!value.every((row) => row.length === width)) return null;
  return value as number[][];
}

function resampleElevation(source: number[][], size: number): number[][] {
  if (source.length === size && source[0].length === size) {
    return source;
  }
  const sourceRows = source.length;
  const sourceCols = source[0].length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const sourceRow = Math.min(
        sourceRows - 1,
        Math.floor((row / size) * sourceRows)
      );
      const sourceCol = Math.min(
        sourceCols - 1,
        Math.floor((col / size) * sourceCols)
      );
      return source[sourceRow][sourceCol];
    })
  );
}

function elevationProvenance(
  status: "observed" | "illustrative"
): HydrologyProvenance {
  if (status === "observed") {
    return {
      sourceId: "opentopography-srtmgl1",
      title: "SRTM GL1 global elevation",
      agency: "OpenTopography / NASA",
      url: SRTM_API,
      observedAt: "2000",
      accessedAt: new Date().toISOString(),
      spatialResolutionM: 30,
      crs: "EPSG:4326",
      confidence: "medium",
      status: "observed",
      caveats: [
        "SRTM is a regional elevation surface, not a surveyed curb-scale terrain model.",
      ],
    };
  }
  return {
    sourceId: "mannahatta-synthetic-slope-fallback",
    title: "Deterministic slope-from-coordinate fallback",
    agency: "Mannahatta",
    url: "https://github.com/topherchris420/cognisync-terrain-weaver",
    accessedAt: new Date().toISOString(),
    confidence: "low",
    status: "speculative",
    caveats: [
      "No live elevation response was available; this surface is illustrative only.",
    ],
  };
}

async function loadElevation(
  bbox: SimBBox,
  resolution: SimulationResolution
): Promise<ElevationResult> {
  const size = RESOLUTION_GRID[resolution];
  const apiKey = Deno.env.get("OPENTOPOGRAPHY_API_KEY") ?? "";
  const params = new URLSearchParams({
    demtype: "SRTMGL1",
    west: bbox.west.toFixed(4),
    east: bbox.east.toFixed(4),
    south: bbox.south.toFixed(4),
    north: bbox.north.toFixed(4),
    outputFormat: "json",
    API_Key: apiKey,
  });
  try {
    const response = await fetch(`${SRTM_API}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`OpenTopography returned ${response.status}.`);
    }
    const payload: unknown = await response.json();
    const source =
      isObject(payload) && "globaldem" in payload
        ? numericGrid(payload.globaldem)
        : null;
    if (!source) throw new Error("OpenTopography returned no numeric grid.");
    return {
      elevation: resampleElevation(source, size),
      status: "observed",
      provenance: elevationProvenance("observed"),
    };
  } catch (error) {
    console.warn("Elevation fetch failed; using illustrative fallback.", error);
    return {
      elevation: fallbackElevation(size),
      status: "illustrative",
      provenance: elevationProvenance("illustrative"),
    };
  }
}

async function cachedV2(
  supabase: SupabaseClient,
  request: SimulationRequestV2
): Promise<SimulationResponseV2 | null> {
  let query = supabase
    .from("simulation_cache")
    .select("result")
    .eq("bbox_north", request.bbox.north)
    .eq("bbox_south", request.bbox.south)
    .eq("bbox_east", request.bbox.east)
    .eq("bbox_west", request.bbox.west)
    .eq("storm_hash", request.storm.hash)
    .eq("surface_hash", request.surface.surfaceHash)
    .eq("model_version", HYDROLOGY_MODEL_VERSION)
    .gt("expires_at", new Date().toISOString());
  if (request.expectedElevationHash !== undefined) {
    query = query.eq("elevation_hash", request.expectedElevationHash);
  }
  const { data, error } = await query.limit(1);
  if (error) {
    console.warn("Counterfactual cache lookup failed.", error);
    return null;
  }
  if (!data || data.length === 0) return null;
  try {
    const result = validateSimulationResponse(data[0].result);
    if (
      result.stormHash !== request.storm.hash ||
      result.surfaceHash !== request.surface.surfaceHash ||
      result.modelVersion !== HYDROLOGY_MODEL_VERSION
    ) {
      console.warn("Ignoring cache row with mismatched simulation identity.");
      return null;
    }
    return result;
  } catch (error) {
    console.warn("Ignoring invalid cached hydrology response.", error);
    return null;
  }
}

async function cacheV2(
  supabase: SupabaseClient,
  request: SimulationRequestV2,
  result: SimulationResponseV2
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await supabase.from("simulation_cache").insert({
    bbox_north: request.bbox.north,
    bbox_south: request.bbox.south,
    bbox_east: request.bbox.east,
    bbox_west: request.bbox.west,
    rainfall_mm: request.storm.rainfallDepthMm,
    storm_hash: request.storm.hash,
    surface_hash: request.surface.surfaceHash,
    model_version: HYDROLOGY_MODEL_VERSION,
    elevation_hash: result.elevationHash,
    expires_at: expiresAt,
    result,
  });
  if (error) console.warn("Counterfactual cache insert failed.", error);
}

function legacySurfaceProvenance(): HydrologyProvenance {
  return {
    sourceId: "legacy-unscoped-surface",
    title: "Legacy unscoped simulation surface",
    agency: "Mannahatta",
    url: "https://github.com/topherchris420/cognisync-terrain-weaver",
    accessedAt: new Date().toISOString(),
    confidence: "low",
    status: "projected",
    caveats: [
      "Legacy requests do not carry a comparable surface identity.",
    ],
  };
}

function adaptLegacyRequest(
  legacy: LegacySimulationRequest
): SimulationRequestV2 {
  const resolution = legacy.resolution ?? "medium";
  const size = RESOLUTION_GRID[resolution];
  return {
    bbox: legacy.bbox,
    storm: {
      id: "legacy-storm",
      rainfallDepthMm: legacy.rainfall_mm,
      durationMinutes: 60,
      distribution: "uniform",
      resolution,
      includeDrainage: false,
      hash: "legacy-unscoped-storm",
    },
    surface: {
      id: "now",
      surfaceHash: "legacy-unscoped-surface",
      baselineLayerHash: "legacy-unscoped-baseline",
      modifiers: {
        bbox: legacy.bbox,
        rows: size,
        cols: size,
        cells: [],
      },
      provenance: [legacySurfaceProvenance()],
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonError(500, "Supabase server credentials are missing.");
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  try {
    if (isV2Request(body)) {
      const simulationRequest = validateSimulationRequest(body);
      const cached = await cachedV2(supabase, simulationRequest);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Hit": "true",
          },
        });
      }
      const start = Date.now();
      const elevation = await loadElevation(
        simulationRequest.bbox,
        simulationRequest.storm.resolution
      );
      const result = runHydrology({
        request: simulationRequest,
        elevation: elevation.elevation,
        elevationProvenance: elevation.provenance,
        elevationStatus: elevation.status,
      });
      result.metadata.computation_time_ms = Date.now() - start;
      await cacheV2(supabase, simulationRequest, result);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const legacy = validateLegacyRequest(body);
    const simulationRequest = adaptLegacyRequest(legacy);
    const elevation = await loadElevation(
      simulationRequest.bbox,
      simulationRequest.storm.resolution
    );
    const start = Date.now();
    const result = runHydrology({
      request: simulationRequest,
      elevation: elevation.elevation,
      elevationProvenance: elevation.provenance,
      elevationStatus: elevation.status,
    });
    return new Response(
      JSON.stringify({
        flow_paths: result.flow_paths,
        risk_zones: result.risk_zones,
        impact_points: result.impact_points,
        metadata: {
          ...result.metadata,
          computation_time_ms: Date.now() - start,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Simulation failed.";
    console.error("Simulation request failed.", error);
    return jsonError(400, message);
  }
});
