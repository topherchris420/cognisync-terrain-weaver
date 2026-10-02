/**
 * LIVE EXTERNAL DATA — opt-in only. Never run in CI.
 *
 *   NODE_USE_ENV_PROXY=1 npm run substrate:fetch            # every source
 *   npm run substrate:fetch -- buildings streets             # some sources
 *   npm run substrate:fetch -- --refresh                     # replace frozen fixtures
 *
 * Freezes the public records the urban substrate is compiled from into
 * experiments/data/substrate/<region>/, one fixture per source. Each fixture
 * holds the records exactly as the provider returned them for the recorded
 * query, plus provenance: provider, dataset id and its last-update stamp,
 * query, retrieval time, licence, method, caveats and a content hash.
 *
 * Only one transformation happens before freezing, and it is recorded: the
 * borough boundaries are clipped to the coverage (plus a margin), because the
 * full shorelines are 26,000+ vertices of which the substrate needs a few
 * hundred. The hash of the full boundary is kept so the clip can be audited.
 *
 * Existing fixtures are kept unless --refresh is passed, so a re-fetch is
 * always a visible diff, never a silent change.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stableHash } from "@/lib/counterfactual/hashing";
import { contentHash } from "@/lib/urban-substrate/sha256";
import { clipRingToRect, positionsToLocal } from "@/lib/urban-substrate/geometry";
import { quantizeLonLat, toLonLat, toLocal } from "@/lib/urban-substrate/projection";
import { coverageBBox, coverageRectM, NYC_LOWER_MANHATTAN, NYC_LOWER_MANHATTAN_SOURCES } from "@/lib/urban-substrate/regions";
import type { Position, SourceFixtureProvenance } from "@/lib/urban-substrate/types";
import { latToTileY, lngToTileX, sampleTerrarium, tileUrl, type PixelBuffer } from "@/lib/hydrology/terrarium";
import { decodePng } from "./lib/png";
import { fetchWithRetry } from "./lib/http";
import { nlcdCoverage } from "./lib/nlcd-wcs";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const OUT = resolve(ROOT, "experiments/data", NYC_LOWER_MANHATTAN_SOURCES);
const RETRIEVED_AT = new Date().toISOString();
const REFRESH = process.argv.includes("--refresh");
const CONFIG = NYC_LOWER_MANHATTAN;
const [WEST, SOUTH, EAST, NORTH] = coverageBBox(CONFIG);
const NYC_TERMS = "NYC Open Data Terms of Use (https://www.nyc.gov/home/terms-of-use.page)";
const SOCRATA_LIMIT = 50_000;

type Provenance = Omit<SourceFixtureProvenance, "contentHash" | "retrievedAt">;

function write(name: string, provenance: Provenance, data: unknown) {
  const path = resolve(OUT, `${name}.json`);
  mkdirSync(dirname(path), { recursive: true });
  // `contentHash` follows the experiment-fixture convention (FNV identity key);
  // the compiler records its own SHA-256 of the same records in the manifest.
  const body = { provenance: { ...provenance, retrievedAt: RETRIEVED_AT, contentHash: stableHash(data) }, data };
  writeFileSync(path, `${JSON.stringify(body)}\n`);
  console.log(`wrote ${name}.json (${Array.isArray(data) ? `${data.length} records` : "grid"})`);
}

function frozen(name: string): boolean {
  if (REFRESH || !existsSync(resolve(OUT, `${name}.json`))) return false;
  console.log(`kept ${name}.json (frozen; pass --refresh to replace)`);
  return true;
}

/** Provider metadata: the dataset's own last-update stamp is its version. */
async function socrataVersion(datasetId: string): Promise<{ name: string; version: string | null }> {
  const view = (await (await fetchWithRetry(`https://data.cityofnewyork.us/api/views/${datasetId}.json`)).json()) as {
    name: string;
    rowsUpdatedAt?: number;
  };
  return { name: view.name, version: view.rowsUpdatedAt ? `rowsUpdatedAt ${new Date(view.rowsUpdatedAt * 1000).toISOString()}` : null };
}

async function socrata(datasetId: string, params: Record<string, string>) {
  const url = `https://data.cityofnewyork.us/resource/${datasetId}.json?${new URLSearchParams({ ...params, $limit: String(SOCRATA_LIMIT) })}`;
  const rows = (await (await fetchWithRetry(url)).json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) throw new Error(`${datasetId}: unexpected response`);
  if (rows.length >= SOCRATA_LIMIT) throw new Error(`${datasetId}: ${rows.length} rows hit the page limit; paginate before freezing.`);
  return { url, rows };
}

/**
 * Every record whose geometry touches the coverage. Socrata's within_box
 * returns only geometries entirely inside the box, which silently drops
 * features crossing its edge; intersects keeps them, and the compiler then
 * decides ownership and counts what falls outside.
 */
const box = (column: string) =>
  `intersects(${column}, 'POLYGON((${WEST} ${SOUTH}, ${EAST} ${SOUTH}, ${EAST} ${NORTH}, ${WEST} ${NORTH}, ${WEST} ${SOUTH}))')`;

/* ------------------------------------------------------------- buildings */

async function fetchBuildings() {
  if (frozen("buildings")) return;
  const id = "5zhs-2jue";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, {
    $select: "the_geom,bin,doitt_id,base_bbl,mappluto_bbl,construction_year,feature_code,geom_source,ground_elevation,height_roof,last_status_type",
    $where: box("the_geom"),
    $order: "doitt_id",
  });
  write("buildings", {
    sourceId: "nyc-building-footprints",
    source: meta.name,
    provider: "NYC Office of Technology and Innovation",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "measured",
    crs: "EPSG:4326 (Socrata geometry)",
    method: "Every footprint whose geometry intersects the coverage box (Socrata intersects), selected fields only, as returned.",
    caveats: [
      "Footprints are photogrammetric or manually digitised planimetric survey; individual footprints may be outdated.",
      "height_roof and ground_elevation are in feet and are absent or zero for some records.",
    ],
  }, rows);
}

/* ----------------------------------------------------------------- PLUTO */

async function fetchPluto() {
  if (frozen("pluto")) return;
  const id = "64uk-42ks";
  const meta = await socrataVersion(id);
  const { readFileSync } = await import("node:fs");
  const buildings = JSON.parse(readFileSync(resolve(OUT, "buildings.json"), "utf8")).data as Array<Record<string, string>>;
  const bbls = [...new Set(buildings.map((b) => (b.mappluto_bbl ?? b.base_bbl ?? "").split(".")[0]).filter((b) => /^\d{10}$/.test(b)))].sort();
  const rows: Array<Record<string, unknown>> = [];
  const queries: string[] = [];
  for (let i = 0; i < bbls.length; i += 80) {
    const { url, rows: page } = await socrata(id, {
      $select: "bbl,landuse,numfloors,bldgclass",
      $where: `bbl in(${bbls.slice(i, i + 80).join(",")})`,
      $order: "bbl",
    });
    queries.push(url);
    rows.push(...page);
  }
  write("pluto", {
    sourceId: "nyc-mappluto",
    source: meta.name,
    provider: "NYC Department of City Planning",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: `${queries.length} batched requests by tax lot (BBL) of the frozen footprints, e.g. ${queries[0]}`,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "reported",
    crs: "none (tabular, joined by BBL)",
    method: `Tax-lot attributes for the ${bbls.length} distinct BBLs referenced by frozen footprints (mappluto_bbl, else base_bbl).`,
    caveats: [
      "PLUTO describes tax lots, not buildings: land use is the lot's, and numfloors is the tallest building on the lot.",
      "Administrative records compiled from several city agencies; not a field survey.",
    ],
  }, rows);
}

/* --------------------------------------------------------------- streets */

async function fetchStreets() {
  if (frozen("streets")) return;
  const id = "inkn-q76z";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, {
    $select: "the_geom,globalid,physicalid,full_street_name,rw_type,status,trafdir,streetwidth,number_travel_lanes,number_park_lanes,from_level_code,to_level_code,nonped",
    $where: box("the_geom"),
    $order: "globalid",
  });
  write("streets", {
    sourceId: "nyc-street-centerline",
    source: meta.name,
    provider: "NYC Office of Technology and Innovation (CSCL)",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "measured",
    crs: "EPSG:4326 (Socrata geometry)",
    method: "Every CSCL segment whose geometry intersects the coverage box, selected fields only, as returned. Field meanings: https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_StreetCenterline.md",
    caveats: [
      "streetwidth is the paved width in feet and is absent for many segments.",
      "trafdir is relative to the segment's address range; nonped is not documented in the published dictionary.",
      "Vertical level codes describe grade separation (13 = at grade), not elevation.",
    ],
  }, rows);
}

/* ------------------------------------------------------------------ water */

async function fetchWaterBodies() {
  if (frozen("water-bodies")) return;
  const id = "pjs3-c3z5";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, {
    $select: "the_geom,source_id,name,feat_code,sub_code,status",
    $where: box("the_geom"),
    $order: "source_id",
  });
  write("water-bodies", {
    sourceId: "nyc-planimetric-hydrography",
    source: meta.name,
    provider: "NYC Office of Technology and Innovation (planimetrics)",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "measured",
    crs: "EPSG:4326 (Socrata geometry)",
    method: "Hydrography polygons (feature codes 2600–2660: lake, pond, river, stream, wetland, beach, bay) intersecting the coverage box. Capture rules: https://github.com/CityOfNewYork/nyc-planimetrics/blob/master/Capture_Rules.md",
    caveats: [
      "Not the 'Hydrography Structures' layer (6hbv-tek4), which holds piers and jetties, not water.",
      "Open harbour and river water is mostly absent from this layer; the substrate derives open water from the shoreline instead.",
    ],
  }, rows);
}

async function fetchShoreline() {
  if (frozen("shoreline")) return;
  const id = "gthc-hcne";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, { $select: "the_geom,borocode,boroname", $order: "borocode" });
  const [x0, y0, x1, y1] = coverageRectM(CONFIG);
  const margin = 64;
  const rect: [number, number, number, number] = [x0 - margin, y0 - margin, x1 + margin, y1 + margin];
  const clipped = rows.flatMap((row) => {
    const geometry = row.the_geom as GeoJSON.MultiPolygon;
    const polygons = geometry.coordinates
      .map((polygon) =>
        polygon
          .map((ring) => clipRingToRect(positionsToLocal(ring as Position[]), rect))
          .filter((ring) => ring.length >= 4)
          .map((ring) => ring.map(([x, y]) => quantizeLonLat(toLonLat(x, y)))),
      )
      .filter((polygon) => polygon.length > 0);
    return polygons.length ? [{ borocode: row.borocode, boroname: row.boroname, rings: polygons.flat() }] : [];
  });
  write("shoreline", {
    sourceId: "nyc-borough-boundaries-shoreline",
    source: meta.name,
    provider: "NYC Department of City Planning",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "measured",
    crs: "EPSG:4326 (rounded to 1e-7° after clipping)",
    method:
      `Shoreline-clipped borough polygons. Before freezing, every ring was clipped (Sutherland–Hodgman, in the substrate grid) to the coverage plus a ${margin} m margin and rounded to 1e-7°; rings are stored without polygon nesting because land is filled by even-odd parity. Full boundary content hash: ${contentHash(rows.map((r) => r.the_geom))}.`,
    caveats: [
      "The shoreline is a digitised boundary at an unspecified tide; piers may or may not be included as land.",
      "Land outside the five boroughs (New Jersey) is not in this dataset and appears as no-data, not water.",
    ],
  }, clipped);
}

/* ------------------------------------------------------------ vegetation */

async function fetchParks() {
  if (frozen("parks")) return;
  const id = "enfh-gkve";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, {
    $select: "multipolygon,gispropnum,signname,typecategory,subcategory,acres",
    $where: box("multipolygon"),
    $order: "gispropnum",
  });
  write("parks", {
    sourceId: "nyc-parks-properties",
    source: meta.name,
    provider: "NYC Department of Parks & Recreation",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "reference",
    crs: "EPSG:4326 (Socrata geometry)",
    method: "Parks properties intersecting the coverage box, selected fields only, as returned.",
    caveats: ["A property boundary, not a vegetation map: plazas, playgrounds and esplanades inside parks are often paved."],
  }, rows);
}

async function fetchTrees() {
  if (frozen("trees")) return;
  const id = "uvpi-gqnh";
  const meta = await socrataVersion(id);
  const { url, rows } = await socrata(id, {
    $select: "tree_id,latitude,longitude,status,spc_common,tree_dbh,health",
    $where: `latitude between ${SOUTH} and ${NORTH} AND longitude between ${WEST} and ${EAST}`,
    $order: "tree_id",
  });
  write("trees", {
    sourceId: "nyc-street-tree-census-2015",
    source: meta.name,
    provider: "NYC Department of Parks & Recreation",
    datasetId: id,
    url: `https://data.cityofnewyork.us/d/${id}`,
    query: url,
    datasetVersion: meta.version,
    license: NYC_TERMS,
    evidence: "measured",
    crs: "EPSG:4326 (latitude/longitude fields)",
    method: "Every 2015 census record (alive, dead or stump) in the coverage box.",
    caveats: [
      "Street trees only; trees in parks and private lots are not censused.",
      "Points, not canopy; the census is from 2015.",
      "tree_dbh is diameter at breast height in inches.",
    ],
  }, rows);
}

/* -------------------------------------------------------------- elevation */

async function fetchElevation() {
  if (frozen("elevation")) return;
  const cell = CONFIG.elevation.localCellM;
  const [x0, y0, x1, y1] = coverageRectM(CONFIG);
  const cols = Math.round((x1 - x0) / cell);
  const rows = Math.round((y1 - y0) / cell);
  const z = 15;
  const buffers = new Map<string, PixelBuffer | null>();
  const urls = new Set<string>();
  const tileBuffer = async (tx: number, ty: number) => {
    const key = `${tx}/${ty}`;
    if (!buffers.has(key)) {
      const url = tileUrl(z, tx, ty);
      urls.add(url);
      try {
        buffers.set(key, decodePng(new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer())));
      } catch {
        buffers.set(key, null);
      }
    }
    return buffers.get(key) ?? null;
  };
  const valuesCm: Array<number | null> = [];
  for (let r = 0; r < rows; r += 1) {
    const y = y1 - (r + 0.5) * cell;
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + (c + 0.5) * cell;
      const [lon, lat] = toLonLat(x, y);
      const fx = lngToTileX(lon, z);
      const fy = latToTileY(lat, z);
      const buffer = await tileBuffer(Math.floor(fx), Math.floor(fy));
      valuesCm.push(buffer ? Math.round(sampleTerrarium(buffer, (fx - Math.floor(fx)) * buffer.width, (fy - Math.floor(fy)) * buffer.height) * 100) : null);
    }
  }
  const [lx0, ly0] = toLocal(WEST, SOUTH);
  write("elevation", {
    sourceId: "mapzen-terrarium",
    source: "Terrarium elevation tiles (AWS Terrain Tiles / Mapzen)",
    provider: "Mapzen / Linux Foundation Terrain Tiles on AWS (blend of USGS 3DEP and other sources)",
    datasetId: null,
    url: "https://registry.opendata.aws/terrain-tiles/",
    query: `z${z} Terrarium PNG tiles: ${[...urls].sort().join(" ")}`,
    datasetVersion: null,
    license: "Terrain Tiles attribution (https://github.com/tilezen/joerd/blob/master/docs/attribution.md); USGS 3DEP is public domain",
    evidence: "measured",
    crs: "EPSG:3857 tiles, sampled at substrate grid cell centres",
    method: `Bilinear sample (the app's sampleTerrarium) at the centre of every ${cell} m cell of the substrate grid over the coverage, row-major from the north row, stored as integer centimetres. Grid west/south ${lx0.toFixed(3)} / ${ly0.toFixed(3)} m.`,
    caveats: [
      "Terrarium blends sources and includes bathymetry; along NYC shorelines it contains artefacts down to −14 km (routing/R3).",
      "Nominal z15 pixel is about 3.6 m at this latitude; the underlying source resolution varies by place.",
      "Vertical datum is not stated per tile by the provider.",
    ],
  }, { cellSizeM: cell, rows, cols, west: x0, north: y1, valuesCm });
}

/* ------------------------------------------------------------------- NLCD */

async function fetchNlcd() {
  if (frozen("nlcd-2021")) return;
  const bbox = { west: WEST, south: SOUTH, east: EAST, north: NORTH };
  const lc = await nlcdCoverage("mrlc_download__NLCD_2021_Land_Cover_L48", bbox);
  const imp = await nlcdCoverage("mrlc_download__NLCD_2021_Impervious_L48", bbox);
  if (lc.grid.cols !== imp.grid.cols || lc.grid.rows !== imp.grid.rows || lc.grid.x0 !== imp.grid.x0) throw new Error("NLCD grids differ");
  const { cols, rows, x0, y0, dx, dy } = lc.grid;
  write("nlcd-2021", {
    sourceId: "usgs-nlcd-2021",
    source: "USGS National Land Cover Database 2021: land cover and percent developed imperviousness (CONUS)",
    provider: "U.S. Geological Survey / Multi-Resolution Land Characteristics Consortium",
    datasetId: "NLCD_2021_Land_Cover_L48; NLCD_2021_Impervious_L48",
    url: "https://www.mrlc.gov/data",
    query: `${lc.url} ; ${imp.url}`,
    datasetVersion: "NLCD 2021 (release of 2023)",
    license: "U.S. Government work, public domain",
    evidence: "reference",
    crs: "EPSG:4326 (server-side nearest-neighbour reprojection of 30 m Albers cells)",
    method: "Raw class codes and impervious percent per cell over the coverage box, as returned.",
    caveats: [
      "NLCD is a remote-sensing product with its own error; agreement with it is not agreement with ground truth.",
      "30 m cells; epoch 2021. Buildings and pavement are not separable.",
    ],
  }, { bbox, cols, rows, x0, y0, dx, dy, landCover: lc.grid.values, impervious: imp.grid.values });
}

const groups: Record<string, () => Promise<void>> = {
  buildings: fetchBuildings,
  pluto: fetchPluto,
  streets: fetchStreets,
  water: fetchWaterBodies,
  shoreline: fetchShoreline,
  parks: fetchParks,
  trees: fetchTrees,
  elevation: fetchElevation,
  nlcd: fetchNlcd,
};
const requested = process.argv.slice(2).filter((a) => a in groups);
console.log(`coverage ${WEST}, ${SOUTH}, ${EAST}, ${NORTH} → ${OUT}`);
for (const name of requested.length ? requested : Object.keys(groups)) {
  console.log(`== ${name}`);
  await groups[name]();
}
