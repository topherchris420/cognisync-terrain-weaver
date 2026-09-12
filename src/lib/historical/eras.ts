/**
 * The era timeline: 1609 → today → a projected future, each backed by a real,
 * published layer rather than an artist's impression.
 *
 * Nothing here is synthesised. Every entry names the body that publishes the
 * imagery, the year it depicts, and whether it is an observation, a scholarly
 * reconstruction, or a projection. Where a layer only covers New York City the
 * `coverage` field says so, and the UI is expected to tell the user plainly
 * instead of showing an empty map.
 */

export type EraProvenance = "reconstruction" | "observed" | "projection";
export type EraCoverage = "nyc" | "global";

export interface MapEra {
  id: string;
  /** Year the layer depicts. Used for ordering and the timeline axis. */
  year: number;
  /** Short label on the timeline. */
  label: string;
  /** One line describing what the eye is actually looking at. */
  caption: string;
  /** `live` uses the map's own satellite imagery, no overlay. */
  kind: "reconstruction" | "raster" | "live" | "projection";
  /** XYZ template, or ArcGIS `{z}/{y}/{x}` for the NOAA service. */
  tiles?: string;
  maxzoom?: number;
  attribution?: string;
  /** Who publishes the layer. */
  agency: string;
  provenance: EraProvenance;
  coverage: EraCoverage;
  /** Overlay opacity when drawn over the live imagery. */
  opacity?: number;
}

/** Bounding box the NYC-only layers cover. */
export const NYC_EXTENT = {
  west: -74.28,
  south: 40.47,
  east: -73.68,
  north: 40.94,
} as const;

const NYC_PHOTO = (year: number) =>
  `https://maps.nyc.gov/xyz/1.0.0/photo/${year}/{z}/{x}/{y}.png8`;

export const ERAS: MapEra[] = [
  {
    id: "1609",
    year: 1609,
    label: "1609",
    caption:
      "The Welikia Project's block-by-block reconstruction of the island before the city.",
    kind: "reconstruction",
    agency: "Welikia Project, Wildlife Conservation Society",
    provenance: "reconstruction",
    coverage: "nyc",
    opacity: 0.7,
  },
  {
    id: "1924",
    year: 1924,
    label: "1924",
    caption: "The city's first complete aerial survey, flown in 1924.",
    kind: "raster",
    tiles: NYC_PHOTO(1924),
    maxzoom: 19,
    attribution: "1924 aerial survey — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "1951",
    year: 1951,
    label: "1951",
    caption: "Post-war aerial survey: the expressway era arriving.",
    kind: "raster",
    tiles: NYC_PHOTO(1951),
    maxzoom: 19,
    attribution: "1951 aerial survey — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "1996",
    year: 1996,
    label: "1996",
    caption: "The first city-wide digital orthophoto series.",
    kind: "raster",
    tiles: NYC_PHOTO(1996),
    maxzoom: 20,
    attribution: "1996 orthoimagery — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "2006",
    year: 2006,
    label: "2006",
    caption: "Mid-2000s orthoimagery, before the current wave of rezoning.",
    kind: "raster",
    tiles: NYC_PHOTO(2006),
    maxzoom: 20,
    attribution: "2006 orthoimagery — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "2016",
    year: 2016,
    label: "2016",
    caption: "Orthoimagery flown after Hurricane Sandy's rebuilding began.",
    kind: "raster",
    tiles: NYC_PHOTO(2016),
    maxzoom: 20,
    attribution: "2016 orthoimagery — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "2018",
    year: 2018,
    label: "2018",
    caption: "The most recent city orthoimagery published as open tiles.",
    kind: "raster",
    tiles: NYC_PHOTO(2018),
    maxzoom: 20,
    attribution: "2018 orthoimagery — NYC Department of Information Technology",
    agency: "City of New York",
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
  },
  {
    id: "today",
    year: new Date().getUTCFullYear(),
    label: "Today",
    caption: "Live satellite imagery — the surface the analysis is run against.",
    kind: "live",
    agency: "Esri, Maxar and the GIS user community",
    provenance: "observed",
    coverage: "global",
  },
  {
    id: "slr-3ft",
    year: 2100,
    label: "+3 ft",
    caption:
      "NOAA's mapped extent of permanent inundation at three feet of sea level rise.",
    kind: "projection",
    tiles:
      "https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_3ft/MapServer/tile/{z}/{y}/{x}",
    maxzoom: 16,
    attribution: "Sea level rise scenario — NOAA Office for Coastal Management",
    agency: "NOAA Office for Coastal Management",
    provenance: "projection",
    coverage: "global",
    opacity: 0.75,
  },
];

export const DEFAULT_ERA_ID = "today";

export function getEra(id: string): MapEra {
  return ERAS.find((era) => era.id === id) ?? ERAS[ERAS.length - 2];
}

/** True when the era's layer actually has data where the map is looking. */
export function eraCoversPoint(era: MapEra, lng: number, lat: number): boolean {
  if (era.coverage === "global") return true;
  return (
    lng >= NYC_EXTENT.west &&
    lng <= NYC_EXTENT.east &&
    lat >= NYC_EXTENT.south &&
    lat <= NYC_EXTENT.north
  );
}

export const PROVENANCE_LABEL: Record<EraProvenance, string> = {
  reconstruction: "Reconstruction",
  observed: "Observed",
  projection: "Projection",
};
