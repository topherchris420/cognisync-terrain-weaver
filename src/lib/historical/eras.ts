/**
 * The era timeline: 1609 → today → a projected future, each backed by a real,
 * published layer rather than an artist's impression.
 *
 * Nothing here is synthesised. Every entry names the body that publishes the
 * imagery, the year it depicts, and whether it is an observation, a scholarly
 * reconstruction, or a projection. Where a layer only covers New York City the
 * `bounds` field says so, and the UI is expected to tell the user plainly
 * instead of showing an empty map.
 *
 * The aerial years are the City's own cached orthoimagery services, published
 * by the Office of Technology and Innovation (OTI) on ArcGIS Online. They
 * replaced `maps.nyc.gov/xyz/1.0.0/photo/{year}`, which was retired and now
 * answers every request with HTTP 200 and a "Map Tile Service has moved"
 * placeholder tile. Each year below points at a service named for that year,
 * and `src/lib/historical/eras.test.ts` holds that line.
 */

import { WELIKIA_TILE_URL } from "@/lib/historical/welikia1609";

export type EraProvenance = "reconstruction" | "observed" | "projection";
export type EraCoverage = "nyc" | "global";
/** [west, south, east, north] in degrees. */
export type LngLatBounds = [number, number, number, number];

export interface MapEra {
  id: string;
  /** Year the layer depicts. Used for ordering and the timeline axis. */
  year: number;
  /** Short label on the timeline. */
  label: string;
  /** One line describing what the eye is actually looking at. */
  caption: string;
  /** `live` uses the map's own satellite imagery, no overlay. */
  kind: "reconstruction" | "raster" | "live" | "projection" | "floodplain";
  /** XYZ template, or ArcGIS `{z}/{y}/{x}` for the ArcGIS tile services. */
  tiles?: string;
  minzoom?: number;
  /** Deepest zoom the publisher caches; MapLibre overzooms past it. */
  maxzoom?: number;
  /** Where tiles exist. MapLibre requests nothing outside it. */
  bounds?: LngLatBounds;
  attribution?: string;
  /** Who publishes the layer. */
  agency: string;
  /** The service or dataset the layer is read from, for provenance. */
  sourceUrl?: string;
  /** When the imagery was captured, as the publisher states it. */
  captured?: string;
  /** What the layer cannot tell you. Shown with the layer. */
  limitations: string[];
  provenance: EraProvenance;
  coverage: EraCoverage;
  /** Overlay opacity when drawn over the live imagery. */
  opacity?: number;
  /**
   * Whether today's 3D building extrusions belong in this scene. They are
   * present-day geometry, so any view of the past hides them: no sourced
   * historical building model exists for these years.
   */
  presentDayBuildings: boolean;
}

/** Bounding box the NYC-only layers cover. */
export const NYC_EXTENT = {
  west: -74.28,
  south: 40.47,
  east: -73.68,
  north: 40.94,
} as const;

const NYC_BOUNDS: LngLatBounds = [
  NYC_EXTENT.west,
  NYC_EXTENT.south,
  NYC_EXTENT.east,
  NYC_EXTENT.north,
];

/** NYC OTI's ArcGIS Online organisation, which hosts the city's orthoimagery. */
export const NYC_ORTHO_HOST =
  "https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services";

const nycOrthoService = (service: string) =>
  `${NYC_ORTHO_HOST}/${service}/MapServer`;

/** ArcGIS cached services order the tile path row-first: `{z}/{y}/{x}`. */
const nycOrthoTiles = (service: string) =>
  `${nycOrthoService(service)}/tile/{z}/{y}/{x}`;

/** Every city service caches levels 0–20; level 21 answers 404. */
const NYC_ORTHO_MAXZOOM = 20;

const DRAPED_ON_TODAY =
  "Draped over today's elevation model, not the ground as it stood that year: shorelines, landfill and grading have changed since.";

const NO_HISTORICAL_BUILDINGS =
  "A flat photograph: no 3D building model exists for this year, so the 3D view shows no buildings rather than today's.";

export const ERAS: MapEra[] = [
  {
    id: "1609",
    year: 1609,
    label: "1609",
    caption:
      "The Welikia Project's block-by-block reconstruction of the island before the city.",
    kind: "reconstruction",
    tiles: WELIKIA_TILE_URL,
    maxzoom: 16,
    bounds: NYC_BOUNDS,
    attribution:
      "1609 reconstruction © Welikia Project, Wildlife Conservation Society",
    agency: "Welikia Project, Wildlife Conservation Society",
    sourceUrl: "https://welikia.org/",
    limitations: [
      "A scholarly reconstruction rendered as a landscape, not a photograph or survey.",
      DRAPED_ON_TODAY,
    ],
    provenance: "reconstruction",
    coverage: "nyc",
    opacity: 0.85,
    presentDayBuildings: false,
  },
  {
    id: "1924",
    year: 1924,
    label: "1924",
    caption: "The city's first complete aerial survey, flown in 1924.",
    kind: "raster",
    tiles: nycOrthoTiles("Ortho_1924_Mosaic"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: [-74.26, 40.492, -73.688, 40.918],
    attribution:
      "1924 aerial survey — NYC Department of City Planning, georeferenced by NYC OTI",
    agency: "City of New York (OTI, from the Department of City Planning)",
    sourceUrl: nycOrthoService("Ortho_1924_Mosaic"),
    captured: "1924",
    limitations: [
      "Scanned black-and-white prints, georeferenced by hand to later imagery; edges can sit several metres off.",
      "Seams between the original prints show as straight lines.",
      NO_HISTORICAL_BUILDINGS,
      DRAPED_ON_TODAY,
    ],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "1951",
    year: 1951,
    label: "1951",
    caption: "Post-war aerial survey: the expressway era arriving.",
    kind: "raster",
    tiles: nycOrthoTiles("NYC_Orthos_1951"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: NYC_BOUNDS,
    attribution:
      "1951 aerial survey — NYC Municipal Archives, georeferenced by NYC OTI",
    agency: "City of New York (OTI, from the Municipal Archives)",
    sourceUrl: nycOrthoService("NYC_Orthos_1951"),
    captured: "1951",
    limitations: [
      "Black-and-white prints georeferenced by hand to later imagery; edges can sit several metres off.",
      NO_HISTORICAL_BUILDINGS,
      DRAPED_ON_TODAY,
    ],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "1996",
    year: 1996,
    label: "1996",
    caption: "The first city-wide digital orthophoto series.",
    kind: "raster",
    tiles: nycOrthoTiles("Ortho_1996_Mosaic"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: [-74.268, 40.495, -73.699, 40.922],
    attribution: "1996 orthoimagery — City of New York, via NYC OTI",
    agency: "City of New York (OTI)",
    sourceUrl: nycOrthoService("Ortho_1996_Mosaic"),
    captured: "April 1996 citywide; June 1996 Manhattan",
    limitations: [
      "One-foot resolution; tall buildings lean away from the camera.",
      NO_HISTORICAL_BUILDINGS,
      DRAPED_ON_TODAY,
    ],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "2006",
    year: 2006,
    label: "2006",
    caption: "Mid-2000s orthoimagery, before the current wave of rezoning.",
    kind: "raster",
    tiles: nycOrthoTiles("NYC_Orthos_2006"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: [-74.277, 40.488, -73.69, 40.929],
    attribution:
      "2006 orthoimagery — New York State Orthoimagery Program, via NYC OTI",
    agency: "New York State Orthoimagery Program, published by NYC OTI",
    sourceUrl: nycOrthoService("NYC_Orthos_2006"),
    captured: "Spring 2006",
    limitations: [
      "True orthoimagery for Manhattan; elsewhere only buildings over six stories were corrected for lean.",
      NO_HISTORICAL_BUILDINGS,
      DRAPED_ON_TODAY,
    ],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "2016",
    year: 2016,
    label: "2016",
    caption: "Orthoimagery flown after Hurricane Sandy's rebuilding began.",
    kind: "raster",
    tiles: nycOrthoTiles("NYC_Orthos_2016"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: [-74.277, 40.488, -73.69, 40.929],
    attribution:
      "2016 orthoimagery — New York State Orthoimagery Program, via NYC OTI",
    agency: "New York State Orthoimagery Program, published by NYC OTI",
    sourceUrl: nycOrthoService("NYC_Orthos_2016"),
    captured: "26 March – 5 April 2016",
    limitations: [NO_HISTORICAL_BUILDINGS, DRAPED_ON_TODAY],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "2018",
    year: 2018,
    label: "2018",
    caption: "Spring 2018 true orthoimagery, six-inch resolution.",
    kind: "raster",
    tiles: nycOrthoTiles("NYC_Orthos_2018"),
    maxzoom: NYC_ORTHO_MAXZOOM,
    bounds: NYC_BOUNDS,
    attribution:
      "2018 orthoimagery — New York State Orthoimagery Program, via NYC OTI",
    agency: "New York State Orthoimagery Program, published by NYC OTI",
    sourceUrl: nycOrthoService("NYC_Orthos_2018"),
    captured: "14 April – 2 May 2018",
    limitations: [NO_HISTORICAL_BUILDINGS, DRAPED_ON_TODAY],
    provenance: "observed",
    coverage: "nyc",
    opacity: 1,
    presentDayBuildings: false,
  },
  {
    id: "today",
    year: new Date().getUTCFullYear(),
    label: "Today",
    caption: "Live satellite imagery — the surface the analysis is run against.",
    kind: "live",
    agency: "Esri, Maxar and the GIS user community",
    limitations: [
      "A recent satellite mosaic; capture dates vary from tile to tile.",
    ],
    provenance: "observed",
    coverage: "global",
    presentDayBuildings: true,
  },
  {
    id: "fp-2050",
    year: 2050,
    label: "2050s",
    caption:
      "The city's mapped 100-year floodplain for the 2050s under projected sea level rise.",
    kind: "floodplain",
    attribution: "Future Floodplain 2050s — NYC Open Data",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
    sourceUrl: "https://data.cityofnewyork.us/d/27ya-gqtm",
    limitations: [
      "A modelled projection drawn over today's city; it is not imagery of the future.",
    ],
    provenance: "projection",
    coverage: "nyc",
    opacity: 0.45,
    presentDayBuildings: true,
  },
  {
    id: "fp-2080",
    year: 2080,
    label: "2080s",
    caption:
      "The city's mapped 100-year floodplain for the 2080s under projected sea level rise.",
    kind: "floodplain",
    attribution:
      "Sea Level Rise Maps (2080s 100-year Floodplain) — NYC Open Data",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
    sourceUrl: "https://data.cityofnewyork.us/d/ek8y-fsqz",
    limitations: [
      "A modelled projection drawn over today's city; it is not imagery of the future.",
    ],
    provenance: "projection",
    coverage: "nyc",
    opacity: 0.45,
    presentDayBuildings: true,
  },
  {
    id: "fp-2100",
    year: 2100,
    label: "2100",
    caption:
      "The city's mapped 100-year floodplain for 2100 under projected sea level rise.",
    kind: "floodplain",
    attribution: "Sea Level Rise Maps (2100 100-year Floodplain) — NYC Open Data",
    agency: "NYC Mayor's Office of Climate & Environmental Justice",
    sourceUrl: "https://data.cityofnewyork.us/d/rf9r-c4pz",
    limitations: [
      "A modelled projection drawn over today's city; it is not imagery of the future.",
    ],
    provenance: "projection",
    coverage: "nyc",
    opacity: 0.45,
    presentDayBuildings: true,
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
    sourceUrl:
      "https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_3ft/MapServer",
    limitations: [
      "A scenario, not a forecast of a date; drawn over today's city.",
    ],
    provenance: "projection",
    coverage: "global",
    opacity: 0.75,
    presentDayBuildings: true,
  },
];

export const DEFAULT_ERA_ID = "today";

export function getEra(id: string): MapEra {
  return (
    ERAS.find((era) => era.id === id) ??
    ERAS.find((era) => era.id === DEFAULT_ERA_ID) ??
    ERAS[0]
  );
}

/** True when the era's layer actually has data where the map is looking. */
export function eraCoversPoint(era: MapEra, lng: number, lat: number): boolean {
  if (era.coverage === "global") return true;
  const [west, south, east, north] = era.bounds ?? NYC_BOUNDS;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** True when the era is a view of the past rather than the present or a projection. */
export function isPastEra(era: MapEra): boolean {
  return !era.presentDayBuildings;
}

/** The concrete URL of one tile, for probing a service before drawing it. */
export function eraTileUrl(
  era: Pick<MapEra, "tiles">,
  z: number,
  x: number,
  y: number
): string | null {
  if (!era.tiles) return null;
  return era.tiles
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

export const PROVENANCE_LABEL: Record<EraProvenance, string> = {
  reconstruction: "Reconstruction",
  observed: "Observed",
  projection: "Projection",
};
