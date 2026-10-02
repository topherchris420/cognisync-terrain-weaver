import { tileBoundsLonLat, tileBoundsM } from "./tile-id";
import type { BBox, SubstrateCompilerConfig } from "./types";

/**
 * Compiled substrate regions. One so far: 5 × 5 local tiles (2.56 km square)
 * around the app's Lower Manhattan example extent, which sits on its central
 * 3 × 3 tiles. The square reaches the Brooklyn waterfront and the harbour, so
 * open water, piers, bridges and grade-separated roads are all exercised.
 */
export const NYC_LOWER_MANHATTAN: SubstrateCompilerConfig = {
  label: "nyc-lower-manhattan-2026-10",
  title: "Lower Manhattan and the Brooklyn waterfront, compiled from NYC public records",
  region: "nyc",
  coverageTiles: { ixMin: 39, iyMin: 45, ixMax: 43, iyMax: 49 },
  elevation: { localCellM: 16, contextCellM: 64, artefactBelowM: -50 },
  water: { localCellM: 8, contextCellM: 32 },
  graph: { nodeMergeToleranceM: 0.5, flatSlope: 0.002, receiverReachM: 40, lowPointSnapM: 24 },
  context: { buildingToleranceM: 2, streetToleranceM: 4 },
  randomness: "none",
};

/** Directory of the frozen source fixtures, relative to experiments/data. */
export const NYC_LOWER_MANHATTAN_SOURCES = "substrate/nyc-lower-manhattan";

/** Coverage as a metric rectangle [x0, y0, x1, y1] with exact tile edges. */
export function coverageRectM(config: SubstrateCompilerConfig): [number, number, number, number] {
  const { ixMin, iyMin, ixMax, iyMax } = config.coverageTiles;
  const sw = tileBoundsM("local", ixMin, iyMin);
  const ne = tileBoundsM("local", ixMax, iyMax);
  return [sw[0], sw[1], ne[2], ne[3]];
}

/** Coverage as a WGS84 bbox, rounded to stored precision. */
export function coverageBBox(config: SubstrateCompilerConfig): BBox {
  const { ixMin, iyMin, ixMax, iyMax } = config.coverageTiles;
  const sw = tileBoundsLonLat("local", ixMin, iyMin);
  const ne = tileBoundsLonLat("local", ixMax, iyMax);
  return [sw[0], sw[1], ne[2], ne[3]];
}
