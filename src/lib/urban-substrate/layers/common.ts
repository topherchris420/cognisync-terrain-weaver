import { canonicalJson } from "@/lib/counterfactual/hashing";
import { positionsToLocal, ringSelfIntersects, signedArea } from "../geometry";
import { quantizeLonLat, toLocal, type XY } from "../projection";
import type { Position } from "../types";

/** A Socrata number field, or null when absent, empty or not a finite number. */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** A positive measurement, or null: providers record "unknown" as 0 or empty. */
export function positiveOrNull(value: unknown): number | null {
  const number = parseNumber(value);
  return number !== null && number > 0 ? number : null;
}

export function textOrNull(value: unknown, blanks: readonly string[] = []): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || blanks.includes(trimmed.toLowerCase()) ? null : trimmed;
}

/** Socrata decimal identifiers ("1000020001.00000000") as integer strings. */
export function integerId(value: unknown): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  const head = text.split(".")[0];
  return /^-?\d+$/.test(head) ? head : null;
}

/**
 * Records in canonical order (by their canonical JSON text). Normalisers walk
 * records in this order, so which of two conflicting records is kept never
 * depends on the order a provider returned them in.
 */
export function inCanonicalOrder<T>(rows: T[]): T[] {
  return rows
    .map((row) => [canonicalJson(row), row] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, row]) => row);
}

/** Plain codepoint comparison: locale-independent, so the same everywhere. */
export function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function countIssues(counter: Record<string, number>, issues: string[]): void {
  for (const issue of issues) counter[issue] = (counter[issue] ?? 0) + 1;
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/**
 * Normalise a polygonal source geometry for storage:
 *  1. round coordinates to 1e-7° and drop consecutive duplicates;
 *  2. close every ring; drop rings with fewer than three distinct vertices or zero area;
 *  3. orient outer rings counter-clockwise and holes clockwise (RFC 7946).
 * Self-intersections are flagged, never repaired: "source-self-intersection"
 * when present in the source, "self-intersection-after-rounding" when edges
 * that were less than about a centimetre apart in the source touch once
 * rounded to the stored precision (reported by the validator, not hidden).
 */
export function normalizePolygonal(geometry: unknown): { geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null; issues: string[] } {
  const issues: string[] = [];
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates)) {
    return { geometry: null, issues: ["unsupported-geometry"] };
  }
  const polygons = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as unknown[][];
  const out: Position[][][] = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon)) continue;
    const rings: Position[][] = [];
    polygon.forEach((rawRing, index) => {
      if (index > 0 && rings.length === 0) return; // holes of a dropped outer ring
      if (!Array.isArray(rawRing) || !rawRing.every(isPosition)) {
        issues.push("non-finite-coordinate");
        return;
      }
      const raw = rawRing as Position[];
      const stored: Position[] = [];
      for (const p of raw) {
        const q = quantizeLonLat([p[0], p[1]]);
        const last = stored[stored.length - 1];
        if (!last || last[0] !== q[0] || last[1] !== q[1]) stored.push(q);
      }
      if (stored.length > 1 && stored[0][0] === stored[stored.length - 1][0] && stored[0][1] === stored[stored.length - 1][1]) stored.pop();
      if (stored.length < 3) {
        issues.push("degenerate-ring");
        return;
      }
      stored.push([stored[0][0], stored[0][1]]);
      const local = positionsToLocal(stored);
      const area = signedArea(local);
      if (area === 0) {
        issues.push("zero-area-ring");
        return;
      }
      const wantCounterClockwise = index === 0;
      const ring = (area > 0) === wantCounterClockwise ? stored : stored.slice().reverse();
      if (ringSelfIntersects(local)) {
        const rawLocal: XY[] = raw.map(([lon, lat]) => toLocal(lon, lat));
        issues.push(ringSelfIntersects(rawLocal) ? "source-self-intersection" : "self-intersection-after-rounding");
      }
      rings.push(ring);
    });
    if (rings.length) out.push(rings);
  }
  if (out.length === 0) return { geometry: null, issues: issues.length ? issues : ["empty-geometry"] };
  return {
    geometry: g.type === "Polygon" ? { type: "Polygon", coordinates: out[0] } : { type: "MultiPolygon", coordinates: out },
    issues: [...new Set(issues)].sort(),
  };
}

/** Bounding box of a polygonal geometry in grid metres. */
export function polygonalBoundsM(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number, number, number] {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0]) {
      const [x, y] = toLocal(lon, lat);
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}
