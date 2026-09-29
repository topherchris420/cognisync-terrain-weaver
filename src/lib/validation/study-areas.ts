import type { SimExtent } from "@/lib/hydrology/types";

/**
 * Benchmark study areas, fixed in experiments/PREREGISTRATION.md before any
 * outcome data were fetched. Named areas are chosen for the conditions they
 * represent; sampled tiles come from a seeded generator, never from outcomes.
 */
export interface StudyArea {
  id: string;
  condition: string;
  selection: "named" | "seeded-sample";
  bbox: SimExtent;
}

export const TILE_LON_SPAN = 0.012;
export const TILE_LAT_SPAN = 0.009;
export const SAMPLE_SEED = 20260929;
/** 40 at preregistration; extended to 200 by Addendum 1 before any holdout read. */
export const SAMPLE_SIZE = 200;
/** Tiles beyond this index carry Terrarium elevation only. */
export const THREE_DEP_SAMPLE_SIZE = 40;
/** Regular grid the seeded sample is drawn from. */
export const NYC_SAMPLING_EXTENT: SimExtent = {
  west: -74.26,
  east: -73.7,
  south: 40.49,
  north: 40.92,
};

function centred(lat: number, lng: number): SimExtent {
  return {
    north: lat + TILE_LAT_SPAN / 2,
    south: lat - TILE_LAT_SPAN / 2,
    east: lng + TILE_LON_SPAN / 2,
    west: lng - TILE_LON_SPAN / 2,
  };
}

export const NAMED_STUDY_AREAS: StudyArea[] = [
  { id: "midtown-dense", condition: "dense urban core", selection: "named", bbox: centred(40.7549, -73.984) },
  { id: "central-park-south", condition: "park-heavy", selection: "named", bbox: centred(40.77, -73.974) },
  {
    id: "lower-manhattan-example",
    condition: "waterfront; the app's example extent",
    selection: "named",
    bbox: { west: -74.014, south: 40.703, east: -74.004, north: 40.712 },
  },
  { id: "jackson-heights", condition: "mixed residential", selection: "named", bbox: centred(40.7505, -73.885) },
  { id: "washington-heights", condition: "strongly sloped", selection: "named", bbox: centred(40.85, -73.937) },
  { id: "canarsie", condition: "nearly flat, low-lying", selection: "named", bbox: centred(40.638, -73.901) },
  { id: "long-island-city", condition: "high-impervious industrial", selection: "named", bbox: centred(40.742, -73.938) },
  { id: "forest-hills-gardens", condition: "high tree canopy", selection: "named", bbox: centred(40.715, -73.843) },
];

/** Small deterministic PRNG; identical sequences in browser, Node and CI. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every grid tile in seeded (Fisher–Yates) order. Acceptance happens later. */
export function seededTileOrder(seed = SAMPLE_SEED, extent = NYC_SAMPLING_EXTENT): SimExtent[] {
  const cols = Math.floor((extent.east - extent.west) / TILE_LON_SPAN);
  const rows = Math.floor((extent.north - extent.south) / TILE_LAT_SPAN);
  const tiles: SimExtent[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const west = extent.west + col * TILE_LON_SPAN;
      const south = extent.south + row * TILE_LAT_SPAN;
      tiles.push({ west, south, east: west + TILE_LON_SPAN, north: south + TILE_LAT_SPAN });
    }
  }
  const random = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function tileProbePoints(bbox: SimExtent): [number, number][] {
  return [
    [bbox.west, bbox.south],
    [bbox.east, bbox.south],
    [bbox.east, bbox.north],
    [bbox.west, bbox.north],
    [(bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2],
  ];
}
