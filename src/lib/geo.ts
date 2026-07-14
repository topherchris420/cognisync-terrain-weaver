import type { AnalysisRecord } from "./types";
import { classifyFloodRisk } from "./absorption";
import { SITE } from "./site";

/**
 * GIS interoperability toolkit.
 *
 * Analyses carry a `[[west, south], [east, north]]` bounding box captured
 * from the map at scan time. These helpers turn stored records into open
 * formats (GeoJSON, CSV) that drop straight into QGIS, ArcGIS, Felt, or a
 * spreadsheet — no proprietary lock-in.
 */

/** `[[west, south], [east, north]]` in WGS84 degrees. */
export type BBox = [[number, number], [number, number]];

const MEAN_EARTH_RADIUS_M = 6_371_008.8;

function isLng(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 180;
}
function isLat(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 90;
}

/**
 * Validate the loosely-typed `bbox` column from the database into a BBox.
 * Returns null for anything malformed rather than throwing.
 */
export function parseBBox(raw: unknown): BBox | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [sw, ne] = raw as unknown[];
  if (!Array.isArray(sw) || !Array.isArray(ne)) return null;
  const [w, s] = sw as unknown[];
  const [e, n] = ne as unknown[];
  if (!isLng(w) || !isLat(s) || !isLng(e) || !isLat(n)) return null;
  if (n <= s) return null;
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * Area of a geodetic bounding box on the WGS84 sphere, in m².
 * Exact for a spherical Earth: A = R² · Δλ · (sin φₙ − sin φₛ).
 */
export function bboxAreaM2(bbox: BBox): number {
  const [[w, s], [e, n]] = bbox;
  // Tolerate views crossing the antimeridian, where east < west numerically.
  const dLngDeg = e >= w ? e - w : e + 360 - w;
  const dLng = (dLngDeg * Math.PI) / 180;
  const sinBand =
    Math.sin((n * Math.PI) / 180) - Math.sin((s * Math.PI) / 180);
  return MEAN_EARTH_RADIUS_M * MEAN_EARTH_RADIUS_M * dLng * sinBand;
}

export function bboxAreaKm2(bbox: BBox): number {
  return bboxAreaM2(bbox) / 1e6;
}

/** Site area for a record, or 0 when no valid bbox was stored. */
export function recordAreaM2(record: Pick<AnalysisRecord, "bbox">): number {
  const bbox = parseBBox(record.bbox);
  return bbox ? bboxAreaM2(bbox) : 0;
}

function deepLink(r: AnalysisRecord): string {
  return `${SITE.url}/analyze?lat=${Number(r.center_lat).toFixed(5)}&lng=${Number(
    r.center_lng
  ).toFixed(5)}&zoom=${Number(r.zoom).toFixed(1)}`;
}

function recordProperties(r: AnalysisRecord) {
  const bbox = parseBBox(r.bbox);
  return {
    id: r.id,
    name: r.name,
    location: r.location_label ?? "",
    absorption_score: Number(r.absorption_score),
    flood_risk: classifyFloodRisk(Number(r.absorption_score)),
    vegetation_pct: Number(r.land_cover?.vegetation ?? 0),
    soil_pct: Number(r.land_cover?.soil ?? 0),
    water_pct: Number(r.land_cover?.water ?? 0),
    buildings_pct: Number(r.land_cover?.buildings ?? 0),
    pavement_pct: Number(r.land_cover?.pavement ?? 0),
    center_lat: Number(r.center_lat),
    center_lng: Number(r.center_lng),
    zoom: Number(r.zoom),
    area_km2: bbox ? Math.round(bboxAreaKm2(bbox) * 1000) / 1000 : null,
    analyzed_at: r.created_at,
    deep_link: deepLink(r),
  };
}

/**
 * Convert analyses into a GeoJSON FeatureCollection (RFC 7946). Records with
 * a stored bounding box become Polygons of the analyzed footprint; the rest
 * fall back to Points at the scan center.
 */
export function analysesToGeoJSON(rows: AnalysisRecord[]) {
  return {
    type: "FeatureCollection" as const,
    features: rows.map((r) => {
      const bbox = parseBBox(r.bbox);
      const geometry = bbox
        ? {
            type: "Polygon" as const,
            coordinates: [
              [
                [bbox[0][0], bbox[0][1]],
                [bbox[1][0], bbox[0][1]],
                [bbox[1][0], bbox[1][1]],
                [bbox[0][0], bbox[1][1]],
                [bbox[0][0], bbox[0][1]],
              ],
            ],
          }
        : {
            type: "Point" as const,
            coordinates: [Number(r.center_lng), Number(r.center_lat)],
          };
      return {
        type: "Feature" as const,
        geometry,
        properties: recordProperties(r),
      };
    }),
  };
}

/** Quote a CSV field per RFC 4180 when it contains commas, quotes, or newlines. */
export function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flatten analyses into a spreadsheet-ready CSV with a header row. */
export function analysesToCSV(rows: AnalysisRecord[]): string {
  const columns = [
    "id",
    "name",
    "location",
    "absorption_score",
    "flood_risk",
    "vegetation_pct",
    "soil_pct",
    "water_pct",
    "buildings_pct",
    "pavement_pct",
    "center_lat",
    "center_lng",
    "zoom",
    "area_km2",
    "analyzed_at",
    "deep_link",
  ] as const;
  const lines = [columns.join(",")];
  for (const r of rows) {
    const props = recordProperties(r);
    lines.push(columns.map((c) => csvEscape(props[c])).join(","));
  }
  return lines.join("\r\n");
}

/** Trigger a browser download of generated text content. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** "mannahatta-sites-2026-07-14.geojson"-style timestamped filename. */
export function exportFilename(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().split("T")[0]}.${ext}`;
}
