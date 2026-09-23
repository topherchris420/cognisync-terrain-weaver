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
import { TERRARIUM_PROTOCOL } from "@/lib/terrarium-protocol";

/** Mapzen Terrarium RGB elevation for the terrain mesh. */
export const TERRARIUM_SOURCE_ID = "terrarium";
/**
 * The same tiles under a second source for the hillshade. The mesh loads DEM
 * a zoom level coarser than the view; sharing one source would shade from
 * that coarser grid.
 */
export const HILLSHADE_SOURCE_ID = "terrarium-shade";
export const HILLSHADE_LAYER_ID = "hillshade";
export const BUILDINGS_SOURCE_ID = "osm-buildings";
export const BUILDINGS_LAYER_ID = "osm-buildings-3d";
export const FLOOD_VOLUME_SOURCE_ID = "flood-volume-source";
export const FLOOD_VOLUME_LAYER_ID = "flood-volume-layer";

/** Overlay tile failures must not fail the satellite imagery providers. */
export const TERRAIN_OVERLAY_SOURCE_IDS = [
  TERRARIUM_SOURCE_ID,
  HILLSHADE_SOURCE_ID,
  BUILDINGS_SOURCE_ID,
] as const;

/** Served through `registerTerrariumProtocol`, which flattens the sea floor. */
const TERRARIUM_TILES = `${TERRARIUM_PROTOCOL}://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`;

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

/** A hint of relief over the imagery people read land cover from. */
export const HILLSHADE_EXAGGERATION_FLAT = 0.3;
/** MapLibre does not light the mesh, so the hillshade is the only slope cue. */
export const HILLSHADE_EXAGGERATION_RELIEF = 1;

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

/**
 * Auto relief: stretch the ground until its local relief stands at a fixed
 * share of the view width. A delta city gets lift, a mountain city stays
 * near true scale, and the same rule holds at every zoom.
 */
export const AUTO_RELIEF_TARGET_RATIO = 0.03;
export const AUTO_RELIEF_MIN = 1.25;
/**
 * Outside lidar coverage Terrarium is a surface model: tower blocks are
 * bumps in the DEM, and past about 4x they stand up as mountains.
 */
export const AUTO_RELIEF_MAX = 4;
/** Below this, Terrarium noise is most of what the samples measure. */
const AUTO_RELIEF_FLOOR_M = 6;
const AUTO_RELIEF_MIN_SAMPLES = 12;

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/**
 * Relief in meters between the 5th and 95th percentile of the samples.
 * Water counts as sea level, matching the display DEM: a harbor channel is
 * not relief the eye should be scaled to.
 */
export function localReliefMeters(elevations: readonly number[]): number | null {
  const land = elevations
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, value))
    .sort((a, b) => a - b);
  if (land.length < AUTO_RELIEF_MIN_SAMPLES) return null;
  return quantile(land, 0.95) - quantile(land, 0.05);
}

export function autoTerrainExaggeration(
  elevations: readonly number[],
  viewSpanMeters: number
): number | null {
  const relief = localReliefMeters(elevations);
  if (relief === null || !Number.isFinite(viewSpanMeters) || viewSpanMeters <= 0) {
    return null;
  }
  const raw =
    (AUTO_RELIEF_TARGET_RATIO * viewSpanMeters) /
    Math.max(AUTO_RELIEF_FLOOR_M, relief);
  const clamped = Math.min(AUTO_RELIEF_MAX, Math.max(AUTO_RELIEF_MIN, raw));
  return Math.round(clamped * 20) / 20;
}

/** Web Mercator ground resolution for MapLibre's 512 px tiles. */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (
    (40_075_016.686 * Math.cos((latitude * Math.PI) / 180)) /
    (512 * 2 ** zoom)
  );
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

/**
 * Three lights, averaged by MapLibre: a warm key, a cool skylight 60 degrees
 * round from it, and a faint rim opposite so slopes facing away from the key
 * still read. All sit near 30 degrees, where flat ground shades to zero and
 * the imagery underneath keeps its own color. Alpha weights the lights.
 */
const HILLSHADE_LIGHTS = [
  { offset: 0, altitude: 32, highlight: "rgba(255, 238, 204, 0.95)", shadow: "rgba(10, 18, 38, 1)" },
  { offset: -60, altitude: 30, highlight: "rgba(214, 232, 255, 0.45)", shadow: "rgba(16, 26, 52, 0.6)" },
  { offset: 75, altitude: 28, highlight: "rgba(255, 250, 240, 0.3)", shadow: "rgba(20, 30, 58, 0.35)" },
] as const;

/**
 * Flat maps keep the cartographic northwest key: lit from the south, a
 * north-up relief reads inside out. A pitched camera has perspective to
 * settle that, so relief takes a low south-southwest afternoon sun that
 * side-lights the slopes and walls facing a north-looking camera.
 */
const FLAT_KEY_AZIMUTH = 315;
const RELIEF_KEY_AZIMUTH = 215;

export function hillshadeLighting(relief: boolean) {
  const key = relief ? RELIEF_KEY_AZIMUTH : FLAT_KEY_AZIMUTH;
  return {
    "hillshade-illumination-direction": HILLSHADE_LIGHTS.map(
      (light) => (key + light.offset + 360) % 360
    ),
    "hillshade-illumination-altitude": HILLSHADE_LIGHTS.map((light) => light.altitude),
    "hillshade-highlight-color": HILLSHADE_LIGHTS.map((light) => light.highlight),
    "hillshade-shadow-color": HILLSHADE_LIGHTS.map((light) => light.shadow),
  } satisfies HillshadeLayerSpecification["paint"];
}

export function hillshadeSource(): RasterDEMSourceSpecification {
  return {
    type: "raster-dem",
    tiles: [TERRARIUM_TILES],
    tileSize: 256,
    maxzoom: 15,
    encoding: "terrarium",
  };
}

export function hillshadeLayer(
  exaggeration: number,
  relief = false
): HillshadeLayerSpecification {
  return {
    id: HILLSHADE_LAYER_ID,
    type: "hillshade",
    source: HILLSHADE_SOURCE_ID,
    paint: {
      "hillshade-method": "multidirectional",
      "hillshade-exaggeration": exaggeration,
      ...hillshadeLighting(relief),
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
      // An architect's massing model: warm limestone low-rise cooling to
      // glass-grey towers, so height reads before the shadows do.
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 8],
        0,
        "#efe8da",
        24,
        "#e4e0d6",
        70,
        "#cfd6da",
        180,
        "#b4c2cb",
      ],
      "fill-extrusion-height": [
        "case",
        [">", ["coalesce", ["get", "render_height"], 0], 0],
        ["get", "render_height"],
        8,
      ],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      // Anything below 1 lets far walls show through near ones.
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  };
}

/** The relief sun, matching the key light of the hillshade in 3D. */
export function terrainLight(): LightSpecification {
  return {
    anchor: "map",
    position: [1.5, RELIEF_KEY_AZIMUTH, 48],
    color: "#fff1dc",
    intensity: 0.52,
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

/**
 * Clear-day aerial perspective. The near ground stays crisp; haze only
 * starts past the middle distance and matches the horizon, so far terrain
 * dissolves into the sky instead of stopping at a hard edge.
 */
export function terrainSky(): SkySpecification {
  return {
    "sky-color": "#4f8fcb",
    "horizon-color": "#e6edf0",
    "fog-color": "#d9e3e8",
    "fog-ground-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "sky-horizon-blend": 0.55,
    "atmosphere-blend": 0,
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
