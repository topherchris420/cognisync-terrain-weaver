import type { SourceFixture } from "./types";

/**
 * Raw records exactly as the providers returned them (see
 * scripts/fetch-substrate-sources.ts). Socrata returns numbers as strings and
 * omits null fields, so every field is optional and parsed during
 * normalisation, never assumed.
 */
export interface RawBuilding {
  the_geom?: { type: string; coordinates: unknown };
  bin?: string;
  doitt_id?: string;
  base_bbl?: string;
  mappluto_bbl?: string;
  construction_year?: string;
  feature_code?: string;
  geom_source?: string;
  ground_elevation?: string;
  height_roof?: string;
  last_status_type?: string;
}

export interface RawPluto {
  bbl?: string;
  landuse?: string;
  numfloors?: string;
  bldgclass?: string;
}

export interface RawStreet {
  the_geom?: { type: string; coordinates: unknown };
  globalid?: string;
  physicalid?: string;
  full_street_name?: string;
  rw_type?: string;
  status?: string;
  trafdir?: string;
  streetwidth?: string;
  number_travel_lanes?: string;
  number_park_lanes?: string;
  from_level_code?: string;
  to_level_code?: string;
  nonped?: string;
}

export interface RawWaterBody {
  the_geom?: { type: string; coordinates: unknown };
  source_id?: string;
  name?: string;
  feat_code?: string;
  sub_code?: string;
  status?: string;
}

export interface RawShoreline {
  borocode?: string;
  boroname?: string;
  /** Rings clipped to the coverage before freezing; land is filled by even-odd parity. */
  rings: Array<Array<[number, number]>>;
}

export interface RawPark {
  multipolygon?: { type: string; coordinates: unknown };
  gispropnum?: string;
  signname?: string;
  typecategory?: string;
  subcategory?: string;
  acres?: string;
}

export interface RawTree {
  tree_id?: string;
  latitude?: string;
  longitude?: string;
  status?: string;
  spc_common?: string;
  tree_dbh?: string;
  health?: string;
}

/** Elevation sampled at the centres of the substrate grid's cells over the coverage. */
export interface RawElevationLattice {
  cellSizeM: number;
  rows: number;
  cols: number;
  /** Grid metres of the lattice's west and north edges. */
  west: number;
  north: number;
  /** Row-major from the north row; integer centimetres; null where the source had no tile. */
  valuesCm: Array<number | null>;
}

export interface RawNlcd {
  bbox: { west: number; south: number; east: number; north: number };
  cols: number;
  rows: number;
  /** Cell-centre longitude of column 0, latitude of row 0, and steps (dy negative). */
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  landCover: number[];
  impervious: number[];
}

export interface SubstrateSources {
  buildings: SourceFixture<RawBuilding[]>;
  pluto: SourceFixture<RawPluto[]>;
  streets: SourceFixture<RawStreet[]>;
  waterBodies: SourceFixture<RawWaterBody[]>;
  shoreline: SourceFixture<RawShoreline[]>;
  parks: SourceFixture<RawPark[]>;
  trees: SourceFixture<RawTree[]>;
  elevation: SourceFixture<RawElevationLattice>;
  nlcd: SourceFixture<RawNlcd>;
}

/** Fixture file of each source within a region's source directory. */
export const SOURCE_FILES: Record<keyof SubstrateSources, string> = {
  buildings: "buildings.json",
  pluto: "pluto.json",
  streets: "streets.json",
  waterBodies: "water-bodies.json",
  shoreline: "shoreline.json",
  parks: "parks.json",
  trees: "trees.json",
  elevation: "elevation.json",
  nlcd: "nlcd-2021.json",
};

/** Load every source of a region through any fixture loader. */
export function loadSources(load: <T>(path: string) => SourceFixture<T>, directory: string): SubstrateSources {
  const get = <K extends keyof SubstrateSources>(key: K) =>
    load<SubstrateSources[K]["data"]>(`${directory}/${SOURCE_FILES[key]}`) as SubstrateSources[K];
  return {
    buildings: get("buildings"),
    pluto: get("pluto"),
    streets: get("streets"),
    waterBodies: get("waterBodies"),
    shoreline: get("shoreline"),
    parks: get("parks"),
    trees: get("trees"),
    elevation: get("elevation"),
    nlcd: get("nlcd"),
  };
}

/**
 * The same sources with every record list in a seeded random order (mulberry32).
 * Used to prove that compilation does not depend on the order providers
 * return records in. Grids are positional and left unchanged.
 */
export function permuteSources(sources: SubstrateSources, seed: number): SubstrateSources {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = <T>(items: T[]) => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return {
    ...sources,
    buildings: { ...sources.buildings, data: shuffle(sources.buildings.data) },
    pluto: { ...sources.pluto, data: shuffle(sources.pluto.data) },
    streets: { ...sources.streets, data: shuffle(sources.streets.data) },
    waterBodies: { ...sources.waterBodies, data: shuffle(sources.waterBodies.data) },
    shoreline: { ...sources.shoreline, data: shuffle(sources.shoreline.data) },
    parks: { ...sources.parks, data: shuffle(sources.parks.data) },
    trees: { ...sources.trees, data: shuffle(sources.trees.data) },
  };
}
