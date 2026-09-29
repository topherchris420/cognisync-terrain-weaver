import type { SimExtent } from "@/lib/hydrology/types";
import type { LandCover } from "@/lib/types";

/** One stored classifier output from the public scan feed fixture. */
export interface FeedRow {
  id: string;
  location_label: string | null;
  center_lat: number;
  center_lng: number;
  zoom: number;
  bbox: unknown;
  land_cover: LandCover;
  absorption_score: number;
  status: string;
  created_at: string;
}

/**
 * Rows that are genuine classifier outputs. Excludes the teaching example and
 * rows labelled `probe` (a manual test insert: 100% water over a mostly-land
 * extent), per experiments/PREREGISTRATION.md Addendum 1.
 */
export function isClassifierOutput(row: Pick<FeedRow, "status" | "location_label">): boolean {
  return row.status !== "example" && row.location_label !== "probe";
}

export function feedExtent(row: Pick<FeedRow, "bbox">): SimExtent | null {
  const box = row.bbox as [[number, number], [number, number]] | null;
  if (!Array.isArray(box) || box.length !== 2) return null;
  const [[west, south], [east, north]] = box;
  if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) return null;
  return { west, south, east, north };
}

/** Frames compared as "identical" when every edge agrees to 1e-6 degrees (~0.1 m). */
export function frameKey(extent: SimExtent): string {
  return [extent.west, extent.south, extent.east, extent.north].map((v) => v.toFixed(6)).join(",");
}

export const LAND_KEYS = ["vegetation", "soil", "buildings", "pavement"] as const;
export const COVER_KEYS = ["vegetation", "soil", "buildings", "pavement", "water"] as const;

/** Aggregations that an independent 30 m reference can actually observe. */
export function aggregateCover(cover: LandCover) {
  const total = COVER_KEYS.reduce((s, k) => s + (cover[k] || 0), 0) || 1;
  const pct = (v: number) => (v / total) * 100;
  return {
    water: pct(cover.water),
    impervious: pct(cover.buildings + cover.pavement),
    pervious: pct(cover.vegetation + cover.soil),
  };
}
