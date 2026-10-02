import { stableHash } from "@/lib/counterfactual/hashing";
import { toLonLat } from "./projection";
import { coverageRectM } from "./regions";
import { permuteSources, type RawBuilding, type RawStreet, type SubstrateSources } from "./sources";
import type { SourceFixtureProvenance, SubstrateCompilerConfig } from "./types";

/**
 * A small synthetic substrate for unit tests: 2 × 2 local tiles, a few
 * buildings and streets, a shoreline cutting off open water to the south,
 * a gentle slope and a uniform reference grid. ILLUSTRATIVE: it stands for
 * nothing real and is never published.
 */
export const TEST_CONFIG: SubstrateCompilerConfig = {
  label: "test-synthetic",
  title: "Synthetic test substrate (illustrative)",
  region: "nyc",
  coverageTiles: { ixMin: 40, iyMin: 46, ixMax: 41, iyMax: 47 },
  elevation: { localCellM: 16, contextCellM: 64, artefactBelowM: -50 },
  water: { localCellM: 8, contextCellM: 32 },
  graph: { nodeMergeToleranceM: 0.5, flatSlope: 0.002, receiverReachM: 40, lowPointSnapM: 24 },
  context: { buildingToleranceM: 2, streetToleranceM: 4 },
  randomness: "none",
};

const [X0, Y0, X1, Y1] = coverageRectM(TEST_CONFIG);
const at = (x: number, y: number) => toLonLat(X0 + x, Y0 + y);

function provenance(sourceId: string, evidence: string, data: unknown): SourceFixtureProvenance {
  return {
    sourceId,
    source: `Synthetic ${sourceId}`,
    provider: "Mannahatta test suite",
    datasetId: null,
    url: "https://example.invalid/synthetic",
    query: "constructed in code",
    datasetVersion: null,
    retrievedAt: "2026-10-01T00:00:00.000Z",
    license: "test fixture",
    evidence,
    crs: "EPSG:4326",
    method: "synthetic",
    caveats: ["Illustrative test data."],
    contentHash: stableHash(data),
  };
}

function square(cx: number, cy: number, half: number): RawBuilding["the_geom"] {
  const ring = [at(cx - half, cy - half), at(cx + half, cy - half), at(cx + half, cy + half), at(cx - half, cy + half), at(cx - half, cy - half)];
  return { type: "MultiPolygon", coordinates: [[ring]] };
}

function line(points: Array<[number, number]>): RawStreet["the_geom"] {
  return { type: "MultiLineString", coordinates: [points.map(([x, y]) => at(x, y))] };
}

export function testSources(): SubstrateSources {
  const buildings: RawBuilding[] = [
    { the_geom: square(200, 600, 20), doitt_id: "11", bin: "1000011", height_roof: "100", ground_elevation: "20", construction_year: "1910", feature_code: "2100", mappluto_bbl: "1000010001" },
    // Straddles the tile boundary at x = 512 m: owned by its centroid's tile, referenced by the other.
    { the_geom: square(520, 700, 30), doitt_id: "12", bin: "1000000", height_roof: "0", feature_code: "2100" },
    { the_geom: square(800, 900, 15), doitt_id: "13", bin: "1000013", height_roof: "45.5", feature_code: "5110" },
  ];
  const streets: RawStreet[] = [
    { the_geom: line([[100, 500], [500, 500]]), globalid: "A", physicalid: "1", full_street_name: "TEST ST", rw_type: "1", status: "2", trafdir: "TW", streetwidth: "30", number_travel_lanes: "2", from_level_code: "13", to_level_code: "13" },
    { the_geom: line([[500, 500], [900, 500]]), globalid: "B", physicalid: "2", full_street_name: "TEST ST", rw_type: "1", status: "2", trafdir: "FT", from_level_code: "13", to_level_code: "13" },
    { the_geom: line([[500, 500], [500, 950]]), globalid: "C", physicalid: "3", full_street_name: "CROSS AVE", rw_type: "1", status: "2", trafdir: "TF", streetwidth: "60", from_level_code: "13", to_level_code: "13" },
    // A bridge deck crossing above the street at (500, 500) without connecting to it.
    { the_geom: line([[300, 300], [700, 700]]), globalid: "D", physicalid: "4", full_street_name: "TEST BRIDGE", rw_type: "3", status: "2", trafdir: "TW", from_level_code: "17", to_level_code: "17", nonped: "V" },
    { the_geom: line([[50, 120], [950, 120]]), globalid: "E", physicalid: "5", full_street_name: "FERRY", rw_type: "14", status: "2", trafdir: "NV" },
  ];
  // Land everywhere north of y = 160 m; open water to the south.
  const land = [at(-64, 160), at(1088, 160), at(1088, 1088), at(-64, 1088), at(-64, 160)];
  const cell = TEST_CONFIG.elevation.localCellM;
  const cols = Math.round((X1 - X0) / cell);
  const rows = Math.round((Y1 - Y0) / cell);
  const valuesCm: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const y = Y1 - Y0 - (r + 0.5) * cell;
      valuesCm.push(y < 160 ? -200 : Math.round(200 + y * 2 + ((r * 7 + c * 3) % 5)));
    }
  }
  const [w, s] = at(0, 0);
  const [e, n] = at(1024, 1024);
  const nlcdCols = 30;
  const nlcdRows = 30;
  const nlcd = {
    bbox: { west: w, south: s, east: e, north: n },
    cols: nlcdCols,
    rows: nlcdRows,
    x0: w + (e - w) / nlcdCols / 2,
    y0: n - (n - s) / nlcdRows / 2,
    dx: (e - w) / nlcdCols,
    dy: -(n - s) / nlcdRows,
    landCover: Array.from({ length: nlcdCols * nlcdRows }, (_, i) => (Math.floor(i / nlcdCols) > 25 ? 11 : 23)),
    impervious: Array.from({ length: nlcdCols * nlcdRows }, (_, i) => (Math.floor(i / nlcdCols) > 25 ? 0 : 70)),
  };
  const fixture = <T>(sourceId: string, evidence: string, data: T) => ({ provenance: provenance(sourceId, evidence, data), data });
  return {
    buildings: fixture("nyc-building-footprints", "measured", buildings),
    pluto: fixture("nyc-mappluto", "reported", [{ bbl: "1000010001.00000000", landuse: "5", numfloors: "8.0000000", bldgclass: "O4" }]),
    streets: fixture("nyc-street-centerline", "measured", streets),
    waterBodies: fixture("nyc-planimetric-hydrography", "measured", [{ the_geom: { type: "MultiPolygon", coordinates: [[[at(700, 300), at(760, 300), at(760, 360), at(700, 360), at(700, 300)]]] }, source_id: "2610001.0", name: "unset", feat_code: "2610" }]),
    shoreline: fixture("nyc-borough-boundaries-shoreline", "measured", [{ borocode: "1", boroname: "Manhattan", rings: [land] }]),
    parks: fixture("nyc-parks-properties", "reference", [{ multipolygon: { type: "MultiPolygon", coordinates: [[[at(600, 800), at(700, 800), at(700, 880), at(600, 880), at(600, 800)]]] }, gispropnum: "M1", signname: "Test Park", typecategory: "Garden" }]),
    trees: fixture("nyc-street-tree-census-2015", "measured", [
      { tree_id: "1", latitude: String(at(300, 510)[1]), longitude: String(at(300, 510)[0]), status: "Alive", spc_common: "pin oak", tree_dbh: "10", health: "Good" },
      { tree_id: "2", latitude: String(at(600, 510)[1]), longitude: String(at(600, 510)[0]), status: "Stump", tree_dbh: "0" },
    ]),
    elevation: fixture("mapzen-terrarium", "measured", { cellSizeM: cell, rows, cols, west: X0, north: Y1, valuesCm }),
    nlcd: fixture("usgs-nlcd-2021", "reference", nlcd),
  };
}

/** Seeded reordering of every source's records; see permuteSources. */
export const shuffledSources = permuteSources;
