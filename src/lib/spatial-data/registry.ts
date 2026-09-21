import type {
  SpatialBbox,
  SpatialSourceDefinition,
} from "./types.ts";

export const MAX_SOCRATA_ROWS = 5_000;

const ACCESSED_AT = "2026-08-10";
const OPEN_DATA_LICENSE =
  "NYC Open Data Terms of Use";

export const SPATIAL_SOURCE_REGISTRY = {
  "nyc-land-cover-2017-6in": {
    id: "nyc-land-cover-2017-6in",
    title: "NYC 2017 land-cover catalog evidence (resolution unverified)",
    agency: "NYC Office of Technology and Innovation",
    officialUrl:
      "https://www.nyc.gov/content/oti/pages/data-analytics/citywide-data-sharing",
    geometryType: "raster",
    displayClass: null,
    observedAt: "2017",
    accessedAt: ACCESSED_AT,
    crs: "Source catalog metadata",
    confidence: "high",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: [
      "Catalog evidence only; source resolution and a browser tile template are not verified.",
    ],
    availability: "catalog-only",
    processingMethod: "Cataloged without client rendering.",
    affectedMetrics: ["source provenance"],
    featureIdFields: [],
  },
  "nyc-building-footprints": {
    id: "nyc-building-footprints",
    title: "Building Footprints",
    agency: "NYC Office of Technology and Innovation",
    officialUrl: "https://data.cityofnewyork.us/d/5zhs-2jue",
    socrataResourceId: "5zhs-2jue",
    geometryField: "the_geom",
    geometryType: "MultiPolygon",
    displayClass: "buildings",
    accessedAt: ACCESSED_AT,
    crs: "EPSG:4326 (Socrata GeoJSON response)",
    confidence: "high",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: ["Layer-level observation date is not published; inspect source attributes."],
    availability: "live",
    processingMethod: "Official polygons clipped by a bounded Socrata query.",
    affectedMetrics: ["impervious area", "runoff estimate"],
    featureIdFields: ["bin", "base_bbl", "objectid"],
  },
  "nyc-roadbed": {
    id: "nyc-roadbed",
    title: "NYC Planimetric Database: Roadbed",
    agency: "NYC Office of Technology and Innovation",
    officialUrl: "https://data.cityofnewyork.us/d/i36f-5ih7",
    socrataResourceId: "i36f-5ih7",
    geometryField: "the_geom",
    geometryType: "MultiPolygon",
    displayClass: "pavement",
    accessedAt: ACCESSED_AT,
    crs: "EPSG:4326 (Socrata GeoJSON response)",
    confidence: "high",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: ["Layer-level observation date is not published."],
    availability: "live",
    processingMethod: "Official polygons clipped by a bounded Socrata query.",
    affectedMetrics: ["impervious area", "runoff estimate"],
    featureIdFields: ["source_id", "objectid"],
  },
  "nyc-sidewalk": {
    id: "nyc-sidewalk",
    title: "NYC Planimetric Database: Sidewalk",
    agency: "NYC Office of Technology and Innovation",
    officialUrl: "https://data.cityofnewyork.us/d/52n9-sdep",
    socrataResourceId: "52n9-sdep",
    geometryField: "the_geom",
    geometryType: "MultiPolygon",
    displayClass: "pavement",
    accessedAt: ACCESSED_AT,
    crs: "EPSG:4326 (Socrata GeoJSON response)",
    confidence: "high",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: ["Layer-level observation date is not published."],
    availability: "live",
    processingMethod: "Official polygons clipped by a bounded Socrata query.",
    affectedMetrics: ["impervious area", "runoff estimate"],
    featureIdFields: ["source_id", "objectid"],
  },
  "nyc-hydrography": {
    id: "nyc-hydrography",
    title: "NYC Planimetric Database: Hydrography",
    agency: "NYC Office of Technology and Innovation",
    officialUrl: "https://data.cityofnewyork.us/d/6hbv-tek4",
    socrataResourceId: "6hbv-tek4",
    geometryField: "the_geom",
    geometryType: "MultiPolygon",
    displayClass: "water",
    accessedAt: ACCESSED_AT,
    crs: "EPSG:4326 (Socrata GeoJSON response)",
    confidence: "high",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: ["Layer-level observation date is not published."],
    availability: "live",
    processingMethod: "Official polygons clipped by a bounded Socrata query.",
    affectedMetrics: ["surface water area", "runoff context"],
    featureIdFields: ["source_id", "objectid"],
  },
  "nyc-tree-inventory": {
    id: "nyc-tree-inventory",
    title: "2015 Street Tree Census - Tree Data",
    agency: "NYC Department of Parks & Recreation",
    officialUrl: "https://data.cityofnewyork.us/d/uvpi-gqnh",
    socrataResourceId: "uvpi-gqnh",
    geometryType: "point-fields",
    displayClass: "tree-observation",
    observedAt: "2015",
    accessedAt: ACCESSED_AT,
    crs: "EPSG:4326 (latitude/longitude fields)",
    confidence: "medium",
    status: "observed",
    license: OPEN_DATA_LICENSE,
    caveats: [
      "Tree records are points, not canopy polygons.",
      "The Socrata GeoJSON geometry is null; latitude and longitude fields are used.",
    ],
    availability: "live",
    processingMethod: "Official latitude/longitude observations clipped to the request.",
    affectedMetrics: ["provenance only"],
    featureIdFields: ["tree_id"],
    latitudeField: "latitude",
    longitudeField: "longitude",
  },
  "usgs-3dep": {
    id: "usgs-3dep",
    title: "USGS 3D Elevation Program",
    agency: "U.S. Geological Survey",
    officialUrl: "https://www.usgs.gov/3d-elevation-program",
    geometryType: "raster",
    displayClass: null,
    accessedAt: ACCESSED_AT,
    crs: "Varies by product",
    confidence: "medium",
    status: "observed",
    license: "U.S. Government public domain",
    caveats: ["Elevation fallback only; not land-cover evidence."],
    availability: "catalog-only",
    processingMethod: "Referenced only when higher-resolution elevation is unavailable.",
    affectedMetrics: ["terrain elevation"],
    featureIdFields: [],
  },
} as const satisfies Record<string, SpatialSourceDefinition>;

export type SpatialSourceId = keyof typeof SPATIAL_SOURCE_REGISTRY;

export const LIVE_LAND_COVER_SOURCE_IDS = [
  "nyc-building-footprints",
  "nyc-roadbed",
  "nyc-sidewalk",
  "nyc-hydrography",
  "nyc-tree-inventory",
] as const satisfies readonly SpatialSourceId[];

export function isValidHttpsTileTemplate(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["{z}", "{x}", "{y}"].every((placeholder) => value.includes(placeholder))
    );
  } catch {
    return false;
  }
}

export function buildSocrataGeoJsonUrl(
  source: SpatialSourceDefinition,
  bbox: SpatialBbox
): URL {
  if (!source.socrataResourceId) {
    throw new Error(`Source ${source.id} has no live Socrata resource`);
  }

  const url = new URL(
    `https://data.cityofnewyork.us/resource/${source.socrataResourceId}.geojson`
  );
  const where = source.geometryField
    ? `within_box(${source.geometryField}, ${bbox.north}, ${bbox.west}, ${bbox.south}, ${bbox.east})`
    : `${source.latitudeField} between ${bbox.south} and ${bbox.north} AND ${source.longitudeField} between ${bbox.west} and ${bbox.east}`;
  url.searchParams.set("$where", where);
  url.searchParams.set("$limit", String(MAX_SOCRATA_ROWS));
  return url;
}
