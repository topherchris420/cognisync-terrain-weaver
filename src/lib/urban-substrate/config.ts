/**
 * The one place where the substrate's grid, tile sizes and format versions
 * are defined. Nothing else in the application may hard-code a tile size.
 *
 * Tile sizes. LOCAL tiles are 512 m: a Mannahatta study extent (about 1 km on
 * a side, routed on 36–120 cells of 8–28 m) touches 4–9 of them, so a study
 * loads full detail for little more than its own footprint, while one dense
 * Manhattan tile still holds only a few hundred buildings. 256 m tiles would
 * quadruple the request count per study for no gain in fidelity; 1,024 m
 * tiles would load up to four times the needed area. 512 m also matches the
 * near tile of BoundlessNYC, so a future adapter between the two can align
 * tiles one to one. CONTEXT tiles are 2,048 m (4 × 4 local tiles) and carry
 * simplified geometry and reduced attributes for surroundings.
 */
export const SUBSTRATE_SCHEMA_VERSION = "mannahatta-substrate/1";

export const SUBSTRATE_COMPILER = {
  name: "mannahatta-urban-substrate-compiler",
  version: "1.0.0",
} as const;

/** Readers accept these schema versions; anything else fails closed. */
export const COMPATIBLE_SCHEMA_VERSIONS: readonly string[] = [SUBSTRATE_SCHEMA_VERSION];

/**
 * Local equirectangular grid over New York City.
 *
 *   x = (lon − originLon) · metresPerDegLon,  y = (lat − originLat) · metresPerDegLat
 *
 * The two scale factors are WGS84 metres per degree at the reference
 * latitude 40.7° (series expansion of the meridian and parallel arc lengths),
 * written as literals so no transcendental function — whose last bit may
 * differ between JavaScript engines — enters tile assignment. Only IEEE-754
 * add, subtract, multiply, divide and floor are used, which every engine
 * rounds identically. Within NYC (latitude 40.49–40.92°) the east–west scale
 * differs from true by at most 0.33%, so planar lengths and areas carry that
 * bound; tile identity does not depend on it.
 */
export const SUBSTRATE_GRID = {
  id: "nyc-local-equirectangular-v1",
  region: "nyc",
  originLon: -74.26,
  originLat: 40.49,
  referenceLatitude: 40.7,
  metresPerDegLon: 84515.477,
  metresPerDegLat: 111048.086,
  maxScaleError: 0.0033,
} as const;

/** Stored geometry is WGS84 longitude/latitude, rounded to 1e-7° (about 1 cm). */
export const SUBSTRATE_CRS = "EPSG:4326";
export const COORDINATE_DECIMALS = 7;

export type SubstrateLevel = "local" | "context";

export const SUBSTRATE_LEVELS: Record<SubstrateLevel, { tileSizeM: number; description: string }> = {
  local: {
    tileSizeM: 512,
    description: "Full geometry and every compiled attribute, for the study extent and a buffer.",
  },
  context: {
    tileSizeM: 2048,
    description: "Simplified geometry and reduced attributes, for surroundings.",
  },
};

/** How much surrounding substrate a study loads by default. */
export const DEFAULT_SUBSTRATE_LOADING = {
  /** Extra metres around the study extent loaded at full detail. */
  localBufferM: 128,
  /** Extra metres around the study extent loaded as context. */
  contextBufferM: 1536,
} as const;

/** Where compiled substrates are published for the browser (under public/). */
export const SUBSTRATE_PUBLIC_DIR = "substrate";
export const SUBSTRATE_INDEX_FILE = "index.json";
