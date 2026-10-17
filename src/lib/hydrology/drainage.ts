/**
 * Real drainage data for the storm engine.
 *
 * Where a scanned block falls inside New York City, the engine loads the
 * NYC DEP citywide catch basin inventory (Socrata `2w2g-fk3i`) and gives each
 * basin a per-event interception capacity. Runoff generated on a cell is
 * removed by the basins in that cell before overland routing — so a real
 * storm floods a real block the way its actual drainage allows.
 *
 * Outside NYC there is no wired inventory yet: the grid reports
 * "unavailable" and every drop routes overland, which the UI must say.
 */
import type { SimExtent } from "./types";

export interface DrainageGrid {
  status: "observed" | "unavailable";
  /** Basins found inside the extent (0 when unavailable). */
  basins: number;
  /** Per-cell interception capacity in m³, rows × cols matching the sim grid. */
  capacityM3: number[][];
  sourceLabel: string;
}

/**
 * Per-event interception capacity of one catch basin, in m³. A conservative
 * planning estimate: a NYC basin in good order passes roughly 3 L/s, and the
 * rising limb of a cloudburst lasts about an hour — 3 L/s × 3600 s ≈ 10.8 m³.
 * Clogged basins pass less; this is an upper bound, stated in the warnings.
 */
export const CATCH_BASIN_EVENT_CAPACITY_M3 = 10;

const NYC_EXTENT = { north: 40.95, south: 40.45, east: -73.65, west: -74.3 };
const SOCRATA_URL = "https://data.cityofnewyork.us/resource/2w2g-fk3i.json";
const MAX_BASINS = 10000;

function intersectsNYC(bbox: SimExtent): boolean {
  return !(
    bbox.south > NYC_EXTENT.north ||
    bbox.north < NYC_EXTENT.south ||
    bbox.west > NYC_EXTENT.east ||
    bbox.east < NYC_EXTENT.west
  );
}

export function emptyDrainage(rows: number, cols: number, sourceLabel: string): DrainageGrid {
  return {
    status: "unavailable",
    basins: 0,
    capacityM3: Array.from({ length: rows }, () => Array(cols).fill(0)),
    sourceLabel,
  };
}

/**
 * Load catch basins for the extent and rasterise them onto the simulation
 * grid. Returns an "unavailable" grid (all zeros) when the extent is outside
 * the wired inventory or the request fails — never throws.
 */
export async function fetchDrainageGrid(
  bbox: SimExtent,
  rows: number,
  cols: number,
  fetchImpl: typeof fetch = fetch
): Promise<DrainageGrid> {
  const sourceLabel = "NYC DEP citywide catch basins (NYC Open Data)";
  if (!intersectsNYC(bbox)) {
    return emptyDrainage(rows, cols, "No drainage inventory wired for this area");
  }

  try {
    const params = new URLSearchParams({
      $select: "latitude,longitude",
      $where: `within_box(the_geom, ${bbox.north}, ${bbox.west}, ${bbox.south}, ${bbox.east})`,
      $limit: String(MAX_BASINS),
    });
    const res = await fetchImpl(`${SOCRATA_URL}?${params}`);
    if (!res.ok) return emptyDrainage(rows, cols, sourceLabel);
    const rows_out = (await res.json()) as Array<{ latitude?: string; longitude?: string }>;

    const capacityM3 = Array.from({ length: rows }, () => Array(cols).fill(0));
    const latStep = (bbox.north - bbox.south) / rows;
    const lngStep = (bbox.east - bbox.west) / cols;
    let basins = 0;
    for (const basin of rows_out) {
      const lat = Number(basin.latitude);
      const lng = Number(basin.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const row = Math.floor((bbox.north - lat) / latStep);
      const col = Math.floor((lng - bbox.west) / lngStep);
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      capacityM3[row][col] += CATCH_BASIN_EVENT_CAPACITY_M3;
      basins += 1;
    }

    return { status: "observed", basins, capacityM3, sourceLabel };
  } catch {
    return emptyDrainage(rows, cols, sourceLabel);
  }
}
