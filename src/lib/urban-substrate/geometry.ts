import { quantizeLonLat, toLocal, toLonLat, type XY } from "./projection";
import type { Position } from "./types";

/**
 * Planar geometry for the compiler, in local grid metres.
 *
 * Every function here uses only IEEE-754 add, subtract, multiply, divide,
 * comparison and Math.sqrt (never `**` or Math.pow, which the specification
 * lets engines approximate), all of which the language specification requires
 * to be correctly rounded. Results are therefore bit-identical in every
 * JavaScript engine. No trigonometric or logarithmic function is used.
 */

export type RectM = [number, number, number, number];

export function positionsToLocal(positions: Position[]): XY[] {
  return positions.map(([lon, lat]) => toLocal(lon, lat));
}

/** Shoelace signed area (positive when counter-clockwise). */
export function signedArea(ring: XY[]): number {
  let twice = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    twice += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return twice / 2;
}

/** Area of a polygon (outer minus holes), m², from WGS84 rings. */
export function polygonAreaM2(polygon: Position[][]): number {
  return polygon.reduce((sum, ring, index) => {
    const area = Math.abs(signedArea(positionsToLocal(ring)));
    return index === 0 ? sum + area : sum - area;
  }, 0);
}

export function geometryAreaM2(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((sum, polygon) => sum + polygonAreaM2(polygon as Position[][]), 0);
}

/** Area-weighted centroid in metres; vertex mean when the area is degenerate. */
export function geometryCentroidM(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): XY {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
  let cx = 0;
  let cy = 0;
  let total = 0;
  let mx = 0;
  let my = 0;
  let count = 0;
  for (const polygon of polygons) {
    polygon.forEach((ringLonLat, index) => {
      const ring = positionsToLocal(ringLonLat);
      // Outer rings add area, holes subtract it, whatever their stored winding.
      const sign = (index === 0 ? 1 : -1) * Math.sign(signedArea(ring));
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        cx += sign * (ring[j][0] + ring[i][0]) * cross;
        cy += sign * (ring[j][1] + ring[i][1]) * cross;
        total += sign * cross;
      }
      for (const [x, y] of ring) {
        mx += x;
        my += y;
        count += 1;
      }
    });
  }
  if (Math.abs(total) < 1e-9) return [mx / Math.max(1, count), my / Math.max(1, count)];
  return [cx / (3 * total), cy / (3 * total)];
}

export function lineLengthM(line: XY[]): number {
  let length = 0;
  for (let i = 1; i < line.length; i += 1) {
    const dx = line[i][0] - line[i - 1][0];
    const dy = line[i][1] - line[i - 1][1];
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/** The point at a distance along a polyline (clamped to its ends). */
export function pointAlong(line: XY[], distance: number): XY {
  let remaining = distance;
  for (let i = 1; i < line.length; i += 1) {
    const dx = line[i][0] - line[i - 1][0];
    const dy = line[i][1] - line[i - 1][1];
    const step = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= step && step > 0) {
      const t = remaining / step;
      return [line[i - 1][0] + dx * t, line[i - 1][1] + dy * t];
    }
    remaining -= step;
  }
  return line[line.length - 1];
}

export function bboxOfPoints(points: XY[]): RectM {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

export function rectsIntersect(a: RectM, b: RectM): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function pointInRect([x, y]: XY, [x0, y0, x1, y1]: RectM): boolean {
  return x >= x0 && x < x1 && y >= y0 && y < y1;
}

/** Overlap area of two rectangles, m². */
export function rectOverlapArea(a: RectM, b: RectM): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Liang–Barsky: does segment a→b touch the closed rectangle? */
export function segmentIntersectsRect(a: XY, b: XY, [x0, y0, x1, y1]: RectM): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, a[0] - x0) && clip(dx, x1 - a[0]) && clip(-dy, a[1] - y0) && clip(dy, y1 - a[1]) && t0 <= t1;
}

export function lineIntersectsRect(line: XY[], rect: RectM): boolean {
  if (line.length === 1) return pointInRect(line[0], rect);
  for (let i = 1; i < line.length; i += 1) if (segmentIntersectsRect(line[i - 1], line[i], rect)) return true;
  return false;
}

/** Douglas–Peucker simplification of an open polyline (endpoints kept). */
export function simplifyLine(points: XY[], tolerance: number): XY[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy);
    let worst = -1;
    let worstDistance = 0;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const distance =
        length === 0 ? Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay)) : Math.abs((px - ax) * dy - (py - ay) * dx) / length;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = i;
      }
    }
    if (worst > 0 && worstDistance > tolerance) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Simplify a closed ring: split at the vertex farthest from the first, simplify
 * each half. Returns null when fewer than three distinct vertices survive.
 */
export function simplifyRing(ring: XY[], tolerance: number): XY[] | null {
  const open = ring.slice(0, -1);
  if (open.length < 3) return null;
  let far = 1;
  let farDistance = -1;
  for (let i = 1; i < open.length; i += 1) {
    const ex = open[i][0] - open[0][0];
    const ey = open[i][1] - open[0][1];
    const d = ex * ex + ey * ey;
    if (d > farDistance) {
      farDistance = d;
      far = i;
    }
  }
  const first = simplifyLine(open.slice(0, far + 1), tolerance);
  const second = simplifyLine([...open.slice(far), open[0]], tolerance);
  const merged = [...first.slice(0, -1), ...second.slice(0, -1)];
  if (merged.length < 3) return null;
  return [...merged, merged[0]];
}

/** Sutherland–Hodgman clip of a closed ring to an axis-aligned rectangle. */
export function clipRingToRect(ring: XY[], [x0, y0, x1, y1]: RectM): XY[] {
  const edges: Array<{ inside: (p: XY) => boolean; cut: (a: XY, b: XY) => XY }> = [
    { inside: (p) => p[0] >= x0, cut: (a, b) => [x0, a[1] + ((x0 - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= x1, cut: (a, b) => [x1, a[1] + ((x1 - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= y0, cut: (a, b) => [a[0] + ((y0 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), y0] },
    { inside: (p) => p[1] <= y1, cut: (a, b) => [a[0] + ((y1 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), y1] },
  ];
  let output = ring.slice(0, -1);
  for (const edge of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      const currentIn = edge.inside(current);
      const previousIn = edge.inside(previous);
      if (currentIn) {
        if (!previousIn) output.push(edge.cut(previous, current));
        output.push(current);
      } else if (previousIn) {
        output.push(edge.cut(previous, current));
      }
    }
    if (output.length === 0) return [];
  }
  return output.length >= 3 ? [...output, output[0]] : [];
}

function orientation(a: XY, b: XY, c: XY): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function onSegment(a: XY, b: XY, p: XY): boolean {
  return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
}

export function segmentsIntersect(p1: XY, p2: XY, q1: XY, q2: XY): boolean {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && onSegment(p1, p2, q1)) ||
    (o2 === 0 && onSegment(p1, p2, q2)) ||
    (o3 === 0 && onSegment(q1, q2, p1)) ||
    (o4 === 0 && onSegment(q1, q2, p2))
  );
}

/** True when two non-adjacent edges of a closed ring touch or cross. */
export function ringSelfIntersects(ring: XY[]): boolean {
  const n = ring.length - 1;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    const ax0 = Math.min(a[0], b[0]);
    const ax1 = Math.max(a[0], b[0]);
    const ay0 = Math.min(a[1], b[1]);
    const ay1 = Math.max(a[1], b[1]);
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // first and last edges share the closing vertex
      const c = ring[j];
      const d = ring[j + 1];
      if (Math.max(c[0], d[0]) < ax0 || Math.min(c[0], d[0]) > ax1 || Math.max(c[1], d[1]) < ay0 || Math.min(c[1], d[1]) > ay1) continue;
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * Even-odd scanline fill of rings onto a north-up grid. Cell (r, c) is inside
 * when its centre has an odd number of ring crossings to its west. Rings from
 * several non-overlapping polygons and their holes are handled together.
 */
export function scanlineFill(rings: XY[][], west: number, north: number, cellM: number, rows: number, cols: number): Uint8Array {
  const inside = new Uint8Array(rows * cols);
  const edges: Array<[number, number, number, number]> = [];
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) edges.push([ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]]);
  }
  for (let r = 0; r < rows; r += 1) {
    const y = north - (r + 0.5) * cellM;
    const crossings: number[] = [];
    for (const [ax, ay, bx, by] of edges) {
      if (ay > y !== by > y) crossings.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    if (crossings.length === 0) continue;
    crossings.sort((a, b) => a - b);
    let k = 0;
    for (let c = 0; c < cols; c += 1) {
      const x = west + (c + 0.5) * cellM;
      while (k < crossings.length && crossings[k] < x) k += 1;
      if (k % 2 === 1) inside[r * cols + c] = 1;
    }
  }
  return inside;
}

/**
 * A street surface: the centreline offset by half its recorded width on both
 * sides, with mitred joins limited to twice the half width. A modelled
 * outline, not the planimetric roadbed: medians, curb returns and junction
 * geometry are not represented.
 */
export function offsetRibbon(line: XY[], halfWidth: number): XY[] | null {
  const points = line.filter((p, i) => i === 0 || p[0] !== line[i - 1][0] || p[1] !== line[i - 1][1]);
  if (points.length < 2 || !(halfWidth > 0)) return null;
  const normals: XY[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const length = Math.sqrt(dx * dx + dy * dy);
    normals.push([-dy / length, dx / length]);
  }
  const offsets: XY[] = points.map((_, i) => {
    if (i === 0) return normals[0];
    if (i === points.length - 1) return normals[normals.length - 1];
    const a = normals[i - 1];
    const b = normals[i];
    const sx = a[0] + b[0];
    const sy = a[1] + b[1];
    const length = Math.sqrt(sx * sx + sy * sy);
    if (length < 1e-9) return a;
    const ux = sx / length;
    const uy = sy / length;
    const cosHalf = Math.max(0.5, ux * a[0] + uy * a[1]);
    return [ux / cosHalf, uy / cosHalf];
  });
  const left = points.map((p, i): XY => [p[0] + offsets[i][0] * halfWidth, p[1] + offsets[i][1] * halfWidth]);
  const right = points.map((p, i): XY => [p[0] - offsets[i][0] * halfWidth, p[1] - offsets[i][1] * halfWidth]);
  const ring = [...right, ...left.reverse()];
  ring.push(ring[0]);
  return signedArea(ring) < 0 ? ring.reverse() : ring;
}

/** Convert a metric ring to stored WGS84 positions (rounded, consecutive duplicates removed). */
export function ringToStored(ring: XY[]): Position[] {
  const out: Position[] = [];
  for (const [x, y] of ring) {
    const p = quantizeLonLat(toLonLat(x, y));
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length > 1 && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push([out[0][0], out[0][1]]);
  return out;
}

export function lineToStored(line: XY[]): Position[] {
  const out: Position[] = [];
  for (const [x, y] of line) {
    const p = quantizeLonLat(toLonLat(x, y));
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}
