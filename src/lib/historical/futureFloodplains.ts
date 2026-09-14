/**
 * New York City's official future floodplains, fetched as real polygons.
 *
 * Nothing here is drawn by hand or interpolated. Each scenario points at a
 * published city dataset of the 100-year floodplain under sea level rise, and
 * the polygons are the ones the city publishes. Geometry is simplified on the
 * server so the browser can draw a whole borough without downloading tens of
 * megabytes; the shapes are otherwise untouched.
 */

export interface FloodplainScenario {
  /** Era id used by the timeline. */
  id: string;
  /** Socrata dataset identifier on data.cityofnewyork.us. */
  dataset: string;
  label: string;
  /** Exact published dataset title, shown as provenance. */
  datasetName: string;
  agency: string;
}

export const FLOODPLAIN_SCENARIOS: FloodplainScenario[] = [
  {
    id: "fp-2050",
    dataset: "27ya-gqtm",
    label: "2050s",
    datasetName: "Future Floodplain 2050s",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
  },
  {
    id: "fp-2080",
    dataset: "ek8y-fsqz",
    label: "2080s",
    datasetName: "Sea Level Rise Maps (2080s 100-year Floodplain)",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
  },
  {
    id: "fp-2100",
    dataset: "rf9r-c4pz",
    label: "2100",
    datasetName: "Sea Level Rise Maps (2100 100-year Floodplain)",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
  },
];

export function getFloodplainScenario(id: string): FloodplainScenario | undefined {
  return FLOODPLAIN_SCENARIOS.find((s) => s.id === id);
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Simplification tolerance in degrees — roughly 20 m, well below block scale. */
const TOLERANCE = 0.0002;

const cache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

function round(value: number) {
  // Snap the request box to a coarse grid so panning reuses one cached fetch.
  return Math.round(value * 20) / 20;
}

function polygonFor(box: BBox) {
  const w = round(box.west);
  const s = round(box.south);
  const e = round(box.east);
  const n = round(box.north);
  return `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
}

/**
 * Real floodplain polygons overlapping the given area, or an empty collection
 * when the city publishes nothing there.
 */
export function loadFloodplain(
  scenarioId: string,
  box: BBox
): Promise<GeoJSON.FeatureCollection> {
  const scenario = getFloodplainScenario(scenarioId);
  if (!scenario) return Promise.resolve(EMPTY);

  const shape = polygonFor(box);
  const key = `${scenario.dataset}:${shape}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = new URL(
    `https://data.cityofnewyork.us/resource/${scenario.dataset}.geojson`
  );
  url.searchParams.set(
    "$select",
    `simplify_preserve_topology(the_geom,${TOLERANCE}) as the_geom`
  );
  url.searchParams.set("$where", `intersects(the_geom,'${shape}')`);
  url.searchParams.set("$limit", "800");

  const request = fetch(url.toString())
    .then(async (response) => {
      if (!response.ok) throw new Error(`Floodplain request failed: ${response.status}`);
      const data = (await response.json()) as GeoJSON.FeatureCollection;
      return data?.features ? data : EMPTY;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, request);
  return request;
}

export function resetFloodplainCache() {
  cache.clear();
}
