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

/** Grid the request box snaps to, in cells per degree: 0.05°, about 5 km. */
const GRID = 20;

/**
 * The box actually requested: the view snapped *outward* to a coarse grid, so
 * panning within a cell reuses one cached fetch and the request always
 * contains the whole view.
 *
 * Rounding each edge to the nearest grid line did not: a view narrower than a
 * cell (any block-scale zoom) could collapse to a line or a sliver beside the
 * view, and the city then answered with nothing, or with polygons for a strip
 * the user was not looking at, while the layer reported the floodplain absent.
 */
export function requestBoxFor(box: BBox): BBox {
  const west = Math.floor(box.west * GRID) / GRID;
  const south = Math.floor(box.south * GRID) / GRID;
  let east = Math.ceil(box.east * GRID) / GRID;
  let north = Math.ceil(box.north * GRID) / GRID;
  if (east <= west) east = west + 1 / GRID;
  if (north <= south) north = south + 1 / GRID;
  return { west, south, east, north };
}

function polygonFor(box: BBox) {
  const { west: w, south: s, east: e, north: n } = requestBoxFor(box);
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

  const request = fetchAllPages(scenario, shape).catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, request);
  return request;
}

/** Rows per request. The 2050s floodplain alone has over a thousand polygons in one block-scale cell. */
const PAGE_SIZE = 2000;
/** Hard ceiling on pages per box, so a misbehaving service can never be polled forever. */
const MAX_PAGES = 10;

function pageUrl(scenario: FloodplainScenario, shape: string, page: number): string {
  const url = new URL(
    `https://data.cityofnewyork.us/resource/${scenario.dataset}.geojson`
  );
  url.searchParams.set(
    "$select",
    `simplify_preserve_topology(the_geom,${TOLERANCE}) as the_geom`
  );
  url.searchParams.set("$where", `intersects(the_geom,'${shape}')`);
  // A fixed order makes the pages a partition of the result, not a shuffle.
  url.searchParams.set("$order", ":id");
  url.searchParams.set("$limit", String(PAGE_SIZE));
  url.searchParams.set("$offset", String(page * PAGE_SIZE));
  return url.toString();
}

/**
 * Every polygon overlapping the box, fetched in pages until a short page
 * arrives. A single capped request silently dropped whatever fell past the
 * cap, which for the 2050s floodplain was most of a zoomed-out view.
 */
async function fetchAllPages(
  scenario: FloodplainScenario,
  shape: string
): Promise<GeoJSON.FeatureCollection> {
  const features: GeoJSON.Feature[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(pageUrl(scenario, shape, page));
    if (!response.ok) throw new Error(`Floodplain request failed: ${response.status}`);
    const data = (await response.json()) as Partial<GeoJSON.FeatureCollection> | null;
    const batch = Array.isArray(data?.features) ? data.features : [];
    features.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return features.length ? { type: "FeatureCollection", features } : EMPTY;
}

export function resetFloodplainCache() {
  cache.clear();
}
