import type { SimExtent } from "../../src/lib/hydrology/types";
import { fetchWithRetry } from "./http";

/** Parse the GeoServer WCS text/plain coverage format into a grid. */
export function parseGeoServerText(text: string) {
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

/** One NLCD coverage over a WGS84 box, reprojected server-side to EPSG:4326. */
export async function nlcdCoverage(coverage: string, bbox: SimExtent) {
  const crs = "http://www.opengis.net/def/crs/EPSG/0/4326";
  const url =
    `https://www.mrlc.gov/geoserver/ows?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${coverage}` +
    `&subsettingCrs=${crs}&outputCrs=${crs}&subset=Long(${bbox.west},${bbox.east})&subset=Lat(${bbox.south},${bbox.north})&format=text/plain`;
  return { url, grid: parseGeoServerText(await (await fetchWithRetry(url)).text()) };
}
