// Edge function: run-simulation
// Server-side hydrological runoff simulation with SRTM elevation data
// - Accepts bbox, rainfall_mm, resolution, include_drainage
// - Fetches elevation data from SRTM with fallback
// - Calculates D8 flow accumulation and risk zones
// - Caches results in simulation_cache table for 24h

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SRTM tile API base URL (OpenTopography Global DEM)
const SRTM_API = "https://portal.opentopography.org/API/globaldem";

// Resolution grid sizes
const RESOLUTION_GRID: Record<string, number> = {
  low: 30,
  medium: 90,
  high: 180,
};

interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface SimulationRequest {
  bbox: BBox;
  rainfall_mm: number;
  resolution: "low" | "medium" | "high";
  include_drainage: boolean;
}

interface FlowPath {
  points: [number, number][];
  volume_m3: number;
  velocity_mps: number;
}

interface RiskZone {
  polygon: [number, number][];
  level: "low" | "moderate" | "high" | "severe";
  affected_area_km2: number;
}

interface ImpactPoint {
  location: [number, number];
  accumulated_volume_m3: number;
  flood_depth_m: number;
  risk_level: string;
}

interface SimulationResponse {
  flow_paths: FlowPath[];
  risk_zones: RiskZone[];
  impact_points: ImpactPoint[];
  metadata: {
    processed_area_km2: number;
    cells_analyzed: number;
    computation_time_ms: number;
  };
}

function jsonError(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, details: details ?? null }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Calculate approximate area in km² from bbox
function calculateAreaKm2(bbox: BBox): number {
  const latDiff = bbox.north - bbox.south;
  const lngDiff = bbox.east - bbox.west;
  // Approximate: 1 degree lat ~ 111 km, lng varies by latitude
  const avgLat = (bbox.north + bbox.south) / 2;
  const lngKm = lngDiff * 111 * Math.cos((avgLat * Math.PI) / 180);
  const latKm = latDiff * 111;
  return latKm * lngKm;
}

// Create fallback elevation grid using simple slope-from-coordinate approximation
function createFallbackElevation(bbox: BBox, gridSize: number): number[][] {
  const elevation: number[][] = [];
  const latStep = (bbox.north - bbox.south) / gridSize;
  const lngStep = (bbox.east - bbox.west) / gridSize;

  // Base elevation decreases from north to south (simulating slope)
  const baseElevation = 100; // meters
  const slopeFactor = 50; // meters difference across the area

  for (let i = 0; i < gridSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < gridSize; j++) {
      const lat = bbox.south + i * latStep;
      // Add some variation based on position
      const elev = baseElevation - (i / gridSize) * slopeFactor + Math.sin(i * 0.5) * 5 + Math.cos(j * 0.3) * 3;
      row.push(elev);
    }
    elevation.push(row);
  }

  return elevation;
}

// Fetch elevation data from SRTM via OpenTopography API
async function fetchSRTMElevation(bbox: BBox, gridSize: number): Promise<number[][]> {
  // Use OpenTopography API for SRTM data
  const south = bbox.south.toFixed(4);
  const north = bbox.north.toFixed(4);
  const west = bbox.west.toFixed(4);
  const east = bbox.east.toFixed(4);

  const url = `${SRTM_API}?demtype=SRTMGL1&west=${west}&east=${east}&south=${south}&north=${north}&outputFormat=json&API_Key=${Deno.env.get("OPENTOPOGRAPHY_API_KEY") || ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`SRTM API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.globaldem) {
      throw new Error("Invalid SRTM response");
    }

    // Convert to 2D array format
    return data.globaldem;
  } catch (error) {
    console.warn("SRTM fetch failed, using fallback:", error);
    throw error;
  }
}

// Main elevation fetch with fallback
async function fetchElevationData(bbox: BBox, resolution: string): Promise<number[][]> {
  const gridSize = RESOLUTION_GRID[resolution] || RESOLUTION_GRID.medium;

  try {
    // Try to fetch from SRTM
    return await fetchSRTMElevation(bbox, gridSize);
  } catch {
    // Fall back to simple approximation
    console.warn("SRTM unavailable, using slope-from-coordinate fallback");
    return createFallbackElevation(bbox, gridSize);
  }
}

// Convert grid cell to lat/lng coordinates
function cellToCoordinate(bbox: BBox, row: number, col: number, gridRows: number, gridCols: number): [number, number] {
  const lat = bbox.south + (row / gridRows) * (bbox.north - bbox.south);
  const lng = bbox.west + (col / gridCols) * (bbox.east - bbox.west);
  return [lat, lng];
}

// D8 flow direction: determine which neighbor receives flow from each cell
function calculateFlowDirection(elevation: number[][], row: number, col: number): [number, number] {
  const rows = elevation.length;
  const cols = elevation[0].length;
  const currentElev = elevation[row][col];

  let maxSlope = -Infinity;
  let flowDir: [number, number] = [row, col]; // Default: flow to self (sink)

  // Check 8 neighbors (D8 algorithm)
  const neighbors = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dr, dc] of neighbors) {
    const nr = row + dr;
    const nc = col + dc;

    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const neighborElev = elevation[nr][nc];
      const distance = Math.sqrt(dr * dr + dc * dc); // Diagonal = sqrt(2)
      const slope = (currentElev - neighborElev) / distance;

      if (slope > maxSlope && slope > 0) {
        maxSlope = slope;
        flowDir = [nr, nc];
      }
    }
  }

  return flowDir;
}

// Calculate flow accumulation using D8 algorithm
function calculateFlowAccumulation(
  elevation: number[][],
  rainfallMm: number,
  bbox: BBox
): { paths: FlowPath[]; riskZones: RiskZone[] } {
  const rows = elevation.length;
  const cols = elevation[0].length;

  if (rows === 0 || cols === 0) {
    return { paths: [], riskZones: [] };
  }

  // Calculate flow direction for each cell
  const flowDir: [number, number][] = [];
  for (let i = 0; i < rows; i++) {
    const row: [number, number][] = [];
    for (let j = 0; j < cols; j++) {
      row.push(calculateFlowDirection(elevation, i, j));
    }
    flowDir.push(row);
  }

  // Initialize accumulation grid
  const accumulation: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0));

  // Calculate cell area in km²
  const cellAreaKm2 = calculateAreaKm2(bbox) / (rows * cols);

  // Add rainfall contribution to each cell (convert mm to m³)
  const rainfallVolumeM3 = (rainfallMm / 1000) * cellAreaKm2 * 1e6; // mm -> m, km² -> m²

  // Initialize with rainfall
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      accumulation[i][j] = rainfallVolumeM3;
    }
  }

  // Propagate flow (iterative accumulation)
  // Sort cells by elevation (high to low) for proper accumulation order
  const cellElevations: { row: number; col: number; elev: number }[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      cellElevations.push({ row: i, col: j, elev: elevation[i][j] });
    }
  }
  cellElevations.sort((a, b) => b.elev - a.elev);

  // Accumulate flow
  for (const cell of cellElevations) {
    const [toRow, toCol] = flowDir[cell.row][cell.col];
    if (toRow !== cell.row || toCol !== cell.col) {
      // Flow to neighbor
      accumulation[toRow][toCol] += accumulation[cell.row][cell.col];
    }
  }

  // Identify flow paths (cells with high accumulation)
  const paths: FlowPath[] = [];
  const pathThreshold = rainfallVolumeM3 * 5; // 5x rainfall threshold

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (accumulation[i][j] > pathThreshold) {
        // Start a flow path from this cell
        const path: [number, number][] = [];
        let [r, c] = [i, j];
        const visited = new Set<string>();

        while (true) {
          const key = `${r},${c}`;
          if (visited.has(key)) break;
          visited.add(key);

          path.push(cellToCoordinate(bbox, r, c, rows, cols));

          const [nextR, nextC] = flowDir[r][c];
          if (nextR === r && nextC === c) break; // Sink
          if (nextR < 0 || nextR >= rows || nextC < 0 || nextC >= cols) break;

          r = nextR;
          c = nextC;
        }

        if (path.length > 1) {
          paths.push({
            points: path,
            volume_m3: accumulation[i][j],
            velocity_mps: Math.sqrt(2 * 9.81 * (elevation[i][j] - elevation[path.length > 1 ? path.length - 1 : 0] || 0)) || 1,
          });
        }
      }
    }
  }

  // Calculate risk zones based on accumulation thresholds
  const riskZones: RiskZone[] = [];
  const allAccumulations = accumulation.flat().sort((a, b) => b - a);

  // Define thresholds for risk levels (percentiles)
  const severeThreshold = allAccumulations[Math.floor(allAccumulations.length * 0.95)] || pathThreshold * 3;
  const highThreshold = allAccumulations[Math.floor(allAccumulations.length * 0.85)] || pathThreshold * 2;
  const moderateThreshold = allAccumulations[Math.floor(allAccumulations.length * 0.70)] || pathThreshold * 1.5;

  // Group high-accumulation cells into zones
  const zoneGrid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (accumulation[i][j] >= moderateThreshold) {
        let level: "low" | "moderate" | "high" | "severe" = "low";
        if (accumulation[i][j] >= severeThreshold) level = "severe";
        else if (accumulation[i][j] >= highThreshold) level = "high";
        else if (accumulation[i][j] >= moderateThreshold) level = "moderate";

        const coord = cellToCoordinate(bbox, i, j, rows, cols);
        zoneGrid[i][j] = level;

        // Create simple polygon for this cell
        const latStep = (bbox.north - bbox.south) / rows;
        const lngStep = (bbox.east - bbox.west) / cols;

        const polygon: [number, number][] = [
          [bbox.south + i * latStep, bbox.west + j * lngStep],
          [bbox.south + i * latStep, bbox.west + (j + 1) * lngStep],
          [bbox.south + (i + 1) * latStep, bbox.west + (j + 1) * lngStep],
          [bbox.south + (i + 1) * latStep, bbox.west + j * lngStep],
          [bbox.south + i * latStep, bbox.west + j * lngStep],
        ];

        riskZones.push({
          polygon,
          level,
          affected_area_km2: cellAreaKm2,
        });
      }
    }
  }

  return { paths, riskZones };
}

// Check cache for previous result
async function getCachedResult(
  supabase: ReturnType<typeof createClient>,
  bbox: BBox,
  rainfallMm: number
): Promise<SimulationResponse | null> {
  const cacheExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("simulation_cache")
    .select("result, created_at")
    .eq("bbox_north", bbox.north)
    .eq("bbox_south", bbox.south)
    .eq("bbox_east", bbox.east)
    .eq("bbox_west", bbox.west)
    .eq("rainfall_mm", rainfallMm)
    .gt("created_at", cacheExpiry)
    .limit(1);

  if (error) {
    console.warn("Cache lookup failed:", error);
    return null;
  }

  return data && data.length > 0 ? data[0].result : null;
}

// Cache simulation result
async function cacheResult(
  supabase: ReturnType<typeof createClient>,
  bbox: BBox,
  rainfallMm: number,
  result: SimulationResponse
): Promise<void> {
  const { error } = await supabase
    .from("simulation_cache")
    .insert({
      bbox_north: bbox.north,
      bbox_south: bbox.south,
      bbox_east: bbox.east,
      bbox_west: bbox.west,
      rainfall_mm: rainfallMm,
      result,
    });

  if (error) {
    console.warn("Cache insert failed:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonError(500, "Supabase server credentials are missing.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: SimulationRequest;
  try {
    body = (await req.json()) as SimulationRequest;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const { bbox, rainfall_mm, resolution, include_drainage } = body;

  // Validate required fields
  if (!bbox || typeof bbox.north !== "number" || typeof bbox.south !== "number" ||
      typeof bbox.east !== "number" || typeof bbox.west !== "number") {
    return jsonError(400, "Invalid or missing bbox.");
  }

  if (typeof rainfall_mm !== "number" || rainfall_mm <= 0) {
    return jsonError(400, "Invalid rainfall_mm. Must be a positive number.");
  }

  // Validate bbox coordinates
  if (bbox.north <= bbox.south || bbox.east <= bbox.west) {
    return jsonError(400, "Invalid bbox: north must be greater than south, east must be greater than west.");
  }

  if (bbox.north > 90 || bbox.south < -90 || bbox.east > 180 || bbox.west < -180) {
    return jsonError(400, "Invalid bbox: coordinates out of range.");
  }

  // Validate area (max 1km²)
  const areaKm2 = calculateAreaKm2(bbox);
  if (areaKm2 > 1) {
    return jsonError(400, "Area too large. Please zoom in to under 1km².");
  }

  // Validate resolution
  if (resolution && !["low", "medium", "high"].includes(resolution)) {
    return jsonError(400, "Invalid resolution. Must be 'low', 'medium', or 'high'.");
  }

  try {
    // Check cache first
    const cached = await getCachedResult(supabase, bbox, rainfall_mm);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Hit": "true" },
      });
    }

    const startTime = Date.now();

    // Fetch elevation data
    const elevation = await fetchElevationData(bbox, resolution || "medium");

    // Calculate flow accumulation and risk zones
    const { paths, riskZones } = calculateFlowAccumulation(elevation, rainfall_mm, bbox);

    const cellsAnalyzed = elevation.length * elevation[0].length;

    const result: SimulationResponse = {
      flow_paths: paths,
      risk_zones: riskZones,
      impact_points: [], // Populated on-demand when user clicks
      metadata: {
        processed_area_km2: Math.round(areaKm2 * 100) / 100,
        cells_analyzed: cellsAnalyzed,
        computation_time_ms: Date.now() - startTime,
      },
    };

    // Cache the result
    await cacheResult(supabase, bbox, rainfall_mm, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (thrown) {
    const error = thrown as Error;
    console.error("Simulation error:", error);

    if (error.message.includes("Area not supported")) {
      return jsonError(400, error.message);
    }

    return jsonError(500, "Simulation failed.", error.message);
  }
});