import type {
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
  HillshadeLayerSpecification,
  LightSpecification,
  RasterDEMSourceSpecification,
  SkySpecification,
  VectorSourceSpecification,
} from "maplibre-gl";
import type { RiskZone } from "@/lib/simulation-types";

/** Mapzen Terrarium RGB elevation, shared by the mesh and the hillshade. */
export const TERRARIUM_SOURCE_ID = "terrarium";
export const HILLSHADE_LAYER_ID = "hillshade";
export const BUILDINGS_SOURCE_ID = "osm-buildings";
export const BUILDINGS_LAYER_ID = "osm-buildings-3d";
export const FLOOD_VOLUME_SOURCE_ID = "flood-volume-source";
export const FLOOD_VOLUME_LAYER_ID = "flood-volume-layer";

/** Overlay tile failures must not fail the satellite imagery providers. */
export const TERRAIN_OVERLAY_SOURCE_IDS = [
  TERRARIUM_SOURCE_ID,
  BUILDINGS_SOURCE_ID,
] as const;

const TERRARIUM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/** Stable TileJSON. The planet extract path inside it changes between builds. */
const BUILDINGS_TILEJSON = "https://tiles.openfreemap.org/planet";

/**
 * Vertical exaggeration by zoom. Regional views need lift so a watershed
 * reads from a pitched camera. Street zoom keeps the mesh closer to real
 * meters so Terrarium noise does not turn a block into a cliff.
 */
const EXAGGERATION_STOPS: ReadonlyArray<readonly [number, number]> = [
  [6, 3.6],
  [10, 2.8],
  [13, 2.05],
  [15, 1.6],
  [17, 1.25],
];

const PITCH_STOPS: ReadonlyArray<readonly [number, number]> = [
  [10, 72],
  [13, 68],
  [15, 64],
  [17, 58],
];

/** Shallow sheet flow still needs a readable column beside buildings. */
export const MIN_FLOOD_DISPLAY_M = 0.6;
/** Cap so a severe cell does not rise through mid-rise buildings. */
export const MAX_FLOOD_DISPLAY_M = 12;

const DEPTH_BY_LEVEL: Record<RiskZone["level"], number> = {
  low: 0.2,
  moderate: 0.45,
  high: 1.1,
  severe: 2.4,
};

export const HILLSHADE_EXAGGERATION_FLAT = 0.85;
export const HILLSHADE_EXAGGERATION_RELIEF = 0.4;

function lerpStops(
  stops: ReadonlyArray<readonly [number, number]>,
  zoom: number
): number {
  const z = Number.isFinite(zoom) ? zoom : 15;
  if (z <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (z >= last[0]) return last[1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [z0, value0] = stops[index];
    const [z1, value1] = stops[index + 1];
    if (z >= z0 && z <= z1) {
      const t = (z - z0) / (z1 - z0);
      return value0 + (value1 - value0) * t;
    }
  }
  return last[1];
}

export function terrainExaggerationForZoom(zoom: number): number {
  return lerpStops(EXAGGERATION_STOPS, zoom);
}

export function terrainPitchForZoom(zoom: number): number {
  return lerpStops(PITCH_STOPS, zoom);
}

export function terrariumSource(): RasterDEMSourceSpecification {
  return {
    type: "raster-dem",
    tiles: [TERRARIUM_TILES],
    tileSize: 256,
    maxzoom: 15,
    encoding: "terrarium",
    attribution: "Elevation © Mapzen / AWS Terrain Tiles",
  };
}

export function hillshadeLayer(
  exaggeration: number
): HillshadeLayerSpecification {
  return {
    id: HILLSHADE_LAYER_ID,
    type: "hillshade",
    source: TERRARIUM_SOURCE_ID,
    paint: {
      "hillshade-exaggeration": exaggeration,
      "hillshade-shadow-color": "#07110e",
      "hillshade-highlight-color": "#f4f7ea",
      "hillshade-illumination-direction": 315,
      "hillshade-illumination-anchor": "map",
    },
  };
}

export function buildingsSource(): VectorSourceSpecification {
  return {
    type: "vector",
    url: BUILDINGS_TILEJSON,
  };
}

export function buildingsLayer(): FillExtrusionLayerSpecification {
  return {
    id: BUILDINGS_LAYER_ID,
    type: "fill-extrusion",
    source: BUILDINGS_SOURCE_ID,
    "source-layer": "building",
    minzoom: 14,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 8],
        0,
        "#d9d3c7",
        28,
        "#b7c3c8",
        90,
        "#8e9aa3",
      ],
      "fill-extrusion-height": [
        "case",
        [">", ["coalesce", ["get", "render_height"], 0], 0],
        ["get", "render_height"],
        8,
      ],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.78,
      "fill-extrusion-vertical-gradient": true,
    },
  };
}

/** Northwest sun, matching the hillshade illumination direction. */
export function terrainLight(): LightSpecification {
  return {
    anchor: "map",
    position: [1.4, 315, 42],
    color: "#fff6ea",
    intensity: 0.62,
  };
}

/** MapLibre's flat-map default, restored when relief is turned off. */
export function flatMapLight(): LightSpecification {
  return {
    anchor: "viewport",
    position: [1.15, 210, 30],
    color: "#ffffff",
    intensity: 0.5,
  };
}

export function terrainSky(): SkySpecification {
  return {
    "sky-color": "#8ec6ea",
    "horizon-color": "#f4f7f5",
    "fog-color": "#d5e3ea",
    "fog-ground-blend": 0.16,
    "horizon-fog-blend": 0.32,
    "sky-horizon-blend": 0.52,
    "atmosphere-blend": 0.65,
  };
}

export function flatMapSky(): SkySpecification {
  return {
    "sky-color": "#88C6FC",
    "horizon-color": "#ffffff",
    "fog-color": "#ffffff",
    "fog-ground-blend": 0,
    "horizon-fog-blend": 0.8,
    "sky-horizon-blend": 0.8,
    "atmosphere-blend": 0,
  };
}

export function floodDepthMeters(zone: {
  level: string;
  flood_depth_m?: number;
}): number {
  if (
    typeof zone.flood_depth_m === "number" &&
    Number.isFinite(zone.flood_depth_m)
  ) {
    return Math.min(4, Math.max(0, zone.flood_depth_m));
  }
  if (zone.level in DEPTH_BY_LEVEL) {
    return DEPTH_BY_LEVEL[zone.level as RiskZone["level"]];
  }
  return DEPTH_BY_LEVEL.moderate;
}

/**
 * Extrusion is in real meters and is not multiplied by terrain exaggeration.
 * Scale the column with the same exaggeration so standing water stays
 * proportional to the stretched DEM, with a floor and a cap so shallow
 * cells stay visible and severe cells stay below building roofs.
 */
export function floodExtrusionHeightExpression(
  exaggeration: number
): ExpressionSpecification {
  const scale = Math.max(1, exaggeration);
  return [
    "case",
    ["<=", ["get", "depth_m"], 0],
    0,
    [
      "min",
      MAX_FLOOD_DISPLAY_M,
      ["max", MIN_FLOOD_DISPLAY_M, ["*", ["get", "depth_m"], scale]],
    ],
  ];
}

export function floodVolumeGeoJSON(zones: RiskZone[]) {
  return {
    type: "FeatureCollection" as const,
    features: zones
      .filter((zone) => zone.polygon.length >= 4)
      .map((zone) => ({
        type: "Feature" as const,
        properties: {
          depth_m: floodDepthMeters(zone),
          level: zone.level,
          affected_area_km2: zone.affected_area_km2,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [zone.polygon],
        },
      })),
  };
}
