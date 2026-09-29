/**
 * LIVE EXTERNAL DATA — opt-in only. Never run in CI.
 *
 *   npm run data:fetch            # everything
 *   npm run data:fetch -- nlcd    # one group: feed | areas | nlcd | dem | 311 | rain
 *
 * Downloads independent reference data and freezes it as DETERMINISTIC
 * FIXTURES under experiments/data/. Every file carries the source, query,
 * retrieval time, licence, method and a content hash. Experiments read only
 * these fixtures, so their results cannot change because a server changed.
 * Re-fetching is a deliberate act that shows up as a diff.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { booleanPointInPolygon } from "@turf/turf";
import { loadElevationGrid } from "@/lib/hydrology/dem";
import { stableHash } from "@/lib/counterfactual/hashing";
import type { SimExtent } from "@/lib/hydrology/types";
import {
  NAMED_STUDY_AREAS,
  SAMPLE_SEED,
  SAMPLE_SIZE,
  THREE_DEP_SAMPLE_SIZE,
  seededTileOrder,
  tileProbePoints,
  type StudyArea,
} from "@/lib/validation/study-areas";
import { EVENTS, OUTCOME_DESCRIPTORS } from "@/lib/validation/events";
import { decodePng } from "./lib/png";
import { decodeFloat32Tiff } from "./lib/tiff";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const DATA = resolve(ROOT, "experiments/data");
const RETRIEVED_AT = new Date().toISOString();

interface Provenance {
  source: string;
  url: string;
  query?: string;
  retrievedAt: string;
  license: string;
  method: string;
  evidence: "measured" | "reported" | "inferred" | "modeled" | "reference";
  caveats: string[];
}

function write(relative: string, provenance: Provenance, data: unknown) {
  const path = resolve(DATA, relative);
  mkdirSync(dirname(path), { recursive: true });
  const body = { provenance: { ...provenance, contentHash: stableHash(data) }, data };
  writeFileSync(path, `${JSON.stringify(body)}\n`);
  console.log(`wrote ${relative}`);
}

function read<T>(relative: string): T {
  return JSON.parse(readFileSync(resolve(DATA, relative), "utf8")).data as T;
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (response.ok) return response;
      last = new Error(`${response.status} ${url}`);
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw last;
}

/* ------------------------------------------------------------ scan feed */

async function fetchFeed() {
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const value = (key: string) => env.match(new RegExp(`${key}="([^"]+)"`))?.[1] ?? "";
  const base = process.env.VITE_SUPABASE_URL ?? value("VITE_SUPABASE_URL");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? value("VITE_SUPABASE_PUBLISHABLE_KEY");
  const select = "id,location_label,center_lat,center_lng,zoom,bbox,land_cover,absorption_score,status,created_at";
  const url = `${base}/rest/v1/analyses?select=${select}&order=created_at.asc&limit=5000`;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`feed ${response.status}`);
  const rows = await response.json();
  write("scan-feed.json", {
    source: "Mannahatta public scan feed (Supabase `analyses`, public read policy)",
    url: `${base}/rest/v1/analyses`,
    query: `select=${select}`,
    retrievedAt: RETRIEVED_AT,
    license: "Application data; captured imagery is not included",
    method: "Read-only snapshot of stored classifier outputs and stored scores. No classification was requested.",
    evidence: "inferred",
    caveats: [
      "Land cover is AI-inferred from captured imagery; the imagery bytes, provider and classifier model version are not stored.",
      "Stored scores are whatever the pipeline wrote at scan time and may predate recalibration.",
    ],
  }, rows);
}

/* ---------------------------------------------------------------- areas */

async function fetchAreas() {
  const url = "https://data.cityofnewyork.us/resource/gthc-hcne.geojson?$limit=50";
  const boundary = (await (await fetchWithRetry(url)).json()) as GeoJSON.FeatureCollection;
  const polygons = boundary.features.filter(
    (f): f is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> =>
      f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
  );
  const onLand = (point: [number, number]) => polygons.some((p) => booleanPointInPolygon(point, p));
  const sampled: StudyArea[] = [];
  let examined = 0;
  for (const bbox of seededTileOrder()) {
    if (sampled.length >= SAMPLE_SIZE) break;
    examined += 1;
    if (tileProbePoints(bbox).every(onLand)) {
      sampled.push({ id: `tile-${String(sampled.length + 1).padStart(2, "0")}`, condition: "seeded sample", selection: "seeded-sample", bbox });
    }
  }
  write("areas.json", {
    source: "NYC Borough Boundaries (shoreline-clipped), NYC Department of City Planning",
    url: "https://data.cityofnewyork.us/d/gthc-hcne",
    query: url,
    retrievedAt: RETRIEVED_AT,
    license: "NYC Open Data Terms of Use",
    method: `Named areas from experiments/PREREGISTRATION.md, plus the first ${SAMPLE_SIZE} tiles in mulberry32(${SAMPLE_SEED}) order whose four corners and centre fall on NYC land. ${examined} tiles examined. The boundary itself is not stored.`,
    evidence: "reference",
    caveats: ["Boundary geometry content hash: " + stableHash(boundary.features.map((f) => f.geometry))],
  }, { named: NAMED_STUDY_AREAS, sampled, examined });
}

function allAreas(): StudyArea[] {
  const areas = read<{ named: StudyArea[]; sampled: StudyArea[] }>("areas.json");
  return [...areas.named, ...areas.sampled];
}

/* ----------------------------------------------------------------- NLCD */

export interface NlcdGrid {
  bbox: SimExtent;
  cols: number;
  rows: number;
  /** Cell-centre longitude of column 0 and latitude of row 0, and steps. */
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  landCover: number[];
  impervious: number[];
}

function parseGeoServerText(text: string) {
  const range = text.match(/GeneralGridEnvelope\[(\d+)\.\.(\d+), (\d+)\.\.(\d+)\]/);
  const param = (name: string) => Number(text.match(new RegExp(`"${name}", ([-0-9.eE]+)`))?.[1]);
  if (!range) throw new Error("Unrecognised WCS text response.");
  const [c0, c1, r0, r1] = range.slice(1).map(Number);
  const body = text.split("Band 0:")[1].trim().split(/\s+/).map(Number);
  const cols = c1 - c0 + 1;
  const rows = r1 - r0 + 1;
  if (body.length !== cols * rows) throw new Error(`WCS grid size mismatch ${body.length} vs ${cols}×${rows}`);
  const dx = param("elt_0_0");
  const dy = param("elt_1_1");
  // GeoTools grid-to-world maps grid indices (pixel centres) to world coordinates.
  return { cols, rows, x0: dx * c0 + param("elt_0_2"), y0: dy * r0 + param("elt_1_2"), dx, dy, values: body };
}

async function nlcdCoverage(coverage: string, bbox: SimExtent) {
  const crs = "http://www.opengis.net/def/crs/EPSG/0/4326";
  const url =
    `https://www.mrlc.gov/geoserver/ows?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${coverage}` +
    `&subsettingCrs=${crs}&outputCrs=${crs}&subset=Long(${bbox.west},${bbox.east})&subset=Lat(${bbox.south},${bbox.north})&format=text/plain`;
  return { url, grid: parseGeoServerText(await (await fetchWithRetry(url)).text()) };
}

async function fetchNlcd() {
  const feed = read<Array<{ id: string; bbox: unknown }>>("scan-feed.json");
  const frames = new Map<string, SimExtent>();
  for (const row of feed) {
    const box = row.bbox as [[number, number], [number, number]] | null;
    if (!Array.isArray(box) || box.length !== 2) continue;
    const bbox = { west: box[0][0], south: box[0][1], east: box[1][0], north: box[1][1] };
    const inConus = bbox.west > -125 && bbox.east < -66 && bbox.south > 24 && bbox.north < 50;
    if (inConus) frames.set(`frame-${stableHash(bbox).slice(8, 20)}`, bbox);
  }
  for (const area of allAreas()) frames.set(area.id, area.bbox);
  const path = resolve(DATA, "nlcd-2021.json");
  // Frozen entries are kept; only missing frames are fetched unless --refresh.
  const out: Record<string, NlcdGrid> =
    existsSync(path) && !process.argv.includes("--refresh") ? read<Record<string, NlcdGrid>>("nlcd-2021.json") : {};
  const urls: string[] = [];
  for (const [id, bbox] of frames) {
    if (out[id]) continue;
    const lc = await nlcdCoverage("mrlc_download__NLCD_2021_Land_Cover_L48", bbox);
    const imp = await nlcdCoverage("mrlc_download__NLCD_2021_Impervious_L48", bbox);
    if (lc.grid.cols !== imp.grid.cols || lc.grid.rows !== imp.grid.rows || lc.grid.x0 !== imp.grid.x0) {
      throw new Error(`NLCD grids differ for ${id}`);
    }
    urls.push(lc.url, imp.url);
    const { cols, rows, x0, y0, dx, dy } = lc.grid;
    out[id] = { bbox, cols, rows, x0, y0, dx, dy, landCover: lc.grid.values, impervious: imp.grid.values };
    console.log(`nlcd ${id} ${cols}×${rows}`);
  }
  write("nlcd-2021.json", {
    source: "USGS National Land Cover Database 2021: land cover and percent developed imperviousness (CONUS)",
    url: "https://www.mrlc.gov/data",
    query: `WCS 2.0.1 GetCoverage (land cover and impervious) per frame, EPSG:4326 output, nearest-neighbour, format=text/plain, e.g. https://www.mrlc.gov/geoserver/ows?service=WCS&version=2.0.1&request=GetCoverage&coverageId=mrlc_download__NLCD_2021_Impervious_L48&subset=Long(w,e)&subset=Lat(s,n)`,
    retrievedAt: RETRIEVED_AT,
    license: "U.S. Government work, public domain",
    method: "Raw 30 m class codes and impervious percent per cell, reprojected by the server to EPSG:4326. Reference fractions are computed in code from cells whose centres fall inside each bounding box.",
    evidence: "reference",
    caveats: [
      "NLCD is itself a remote-sensing product with its own error; agreement is with a reference, not with ground truth.",
      "Epoch 2021; scans are 2026. Buildings and pavement are not separable.",
      "Class code 0 marks cells outside the reprojected coverage and is ignored.",
    ],
  }, out);
}

/* ------------------------------------------------------------------ DEM */

const decode = async (blob: Blob) => decodePng(new Uint8Array(await blob.arrayBuffer()));
const cm = (values: number[][]) => values.map((row) => row.map((v) => Math.round(v * 100)));

async function threeDep(bbox: SimExtent, size: number) {
  const url =
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage" +
    `?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&bboxSR=4326&imageSR=4326&size=${size},${size}` +
    "&format=tiff&pixelType=F32&compression=None&interpolation=RSP_BilinearInterpolation&f=image";
  const raster = decodeFloat32Tiff(new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer()));
  const values: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    values.push(Array.from(raster.values.subarray(row * raster.width, row * raster.width + size)));
  }
  if (values.flat().some((v) => !Number.isFinite(v) || v < -500)) throw new Error("3DEP returned nodata");
  return { url, values };
}

async function fetchDem() {
  const areas = allAreas();
  for (const [index, area] of areas.entries()) {
    // Existing fixtures are frozen evidence; re-fetch only with --refresh.
    if (existsSync(resolve(DATA, `dem/${area.id}.json`)) && !process.argv.includes("--refresh")) continue;
    const sizes = area.selection === "named" ? [36, 72, 120] : [72];
    const withThreeDep = area.selection === "named" || index < NAMED_STUDY_AREAS.length + THREE_DEP_SAMPLE_SIZE;
    const terrarium: Record<string, { status: string; hash: string; centimetres: number[][] }> = {};
    for (const size of sizes) {
      const grid = await loadElevationGrid(area.bbox, size, size, fetch, decode);
      if (grid.status !== "observed") throw new Error(`Terrarium unavailable for ${area.id}`);
      terrarium[size] = { status: grid.status, hash: grid.hash, centimetres: cm(grid.values) };
    }
    const dep = withThreeDep ? await threeDep(area.bbox, 72) : null;
    write(`dem/${area.id}.json`, {
      source: "Mapzen Terrarium tiles (AWS Terrain Tiles) and USGS 3DEP Bare Earth dynamic ImageServer",
      url: "https://registry.opendata.aws/terrain-tiles/ ; https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer",
      query: `Terrarium via the app's own loadElevationGrid at ${sizes.join("/")} cells; 3DEP: ${dep?.url ?? "not fetched (Addendum 1: tiles beyond the first 40 carry Terrarium only)"}`,
      retrievedAt: RETRIEVED_AT,
      license: "Terrain Tiles: see AWS registry attribution (USGS 3DEP and others); 3DEP: U.S. Government public domain",
      method: "Elevation stored as integer centimetres. `hash` is the app's hash of the unrounded grid at fetch time.",
      evidence: "measured",
      caveats: [
        "Terrarium blends sources and includes bathymetry below sea level; it is not bare-earth lidar at street scale.",
        "Both products derive in part from USGS elevation data, so they are not fully independent sources.",
        "3DEP is resampled by the server to the same grid (bilinear); Terrarium by the app (bilinear within tiles).",
      ],
    }, { area, terrarium, threeDep72: dep ? cm(dep.values) : null });
  }
}

/* ------------------------------------------------------------------ 311 */

async function fetch311() {
  for (const event of EVENTS) {
    const where =
      `created_date between '${event.start}' and '${event.end}' AND complaint_type='Sewer' ` +
      `AND descriptor in(${OUTCOME_DESCRIPTORS.map((d) => `'${d}'`).join(",")}) AND latitude IS NOT NULL`;
    const url =
      "https://data.cityofnewyork.us/resource/erm2-nwe9.json?" +
      new URLSearchParams({
        $select: "unique_key,created_date,descriptor,latitude,longitude",
        $where: where,
        $order: "unique_key",
        $limit: "50000",
      });
    const rows = (await (await fetchWithRetry(url)).json()) as Array<Record<string, string>>;
    const points = rows.map((r) => ({
      key: r.unique_key,
      created: r.created_date,
      descriptor: r.descriptor,
      lat: Number(r.latitude),
      lon: Number(r.longitude),
    }));
    write(`311/${event.id}.json`, {
      source: "NYC 311 Service Requests from 2010 to Present",
      url: "https://data.cityofnewyork.us/d/erm2-nwe9",
      query: url,
      retrievedAt: RETRIEVED_AT,
      license: "NYC Open Data Terms of Use",
      method: `All geocoded Sewer requests with descriptors ${OUTCOME_DESCRIPTORS.join("; ")} created in the event window (${event.role}).`,
      evidence: "reported",
      caveats: [
        "Complaints are reports, not measurements of water depth or extent.",
        "Absence of a complaint is not a dry observation; reporting depends on population, road use and awareness.",
        "Coordinates are geocoded addresses or intersections, not the exact location of water.",
      ],
    }, { event, points });
  }
}

/* ----------------------------------------------------------------- rain */

async function fetchRain() {
  const url =
    "https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728" +
    "&startDate=2021-08-20&endDate=2023-09-30&dataTypes=PRCP&format=json&units=metric";
  try {
    const rows = (await (await fetchWithRetry(url, 2)).json()) as Array<{ DATE: string; PRCP: string }>;
    const touched = (date: string) => EVENTS.some((e) => date >= e.start.slice(0, 10) && date <= e.end.slice(0, 10));
    const kept = rows.filter((r) => touched(r.DATE)).map((r) => ({ date: r.DATE, prcpMm: Number(r.PRCP) }));
    write("rain-central-park.json", {
      source: "NOAA NCEI Global Historical Climatology Network daily, Central Park (USW00094728)",
      url: "https://www.ncei.noaa.gov/access/services/data/v1",
      query: url,
      retrievedAt: RETRIEVED_AT,
      license: "U.S. Government work, public domain",
      method: "Daily precipitation for the calendar dates touched by each event window.",
      evidence: "measured",
      caveats: ["One gauge; rainfall varied strongly across the city in each event. Context only, not model forcing."],
    }, kept);
  } catch (error) {
    console.warn(`rain: NCEI unavailable (${String(error)}); no rainfall fixture written.`);
  }
}

const groups: Record<string, () => Promise<void>> = {
  feed: fetchFeed,
  areas: fetchAreas,
  nlcd: fetchNlcd,
  dem: fetchDem,
  311: fetch311,
  rain: fetchRain,
};
const requested = process.argv.slice(2).filter((a) => a in groups);
for (const name of requested.length ? requested : Object.keys(groups)) {
  if (name !== "feed" && name !== "areas" && !existsSync(resolve(DATA, "areas.json"))) await fetchAreas();
  console.log(`== ${name}`);
  await groups[name]();
}
