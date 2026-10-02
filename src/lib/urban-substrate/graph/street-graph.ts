import { roundTo, toLocal, type XY } from "../projection";
import { AT_GRADE_LEVEL } from "../layers/streets";
import type { GraphNodeKind, Position, StreetGraphEdge, StreetGraphNode, StreetSegmentFeature } from "../types";

/**
 * Street graph: intersections and endpoints joined by CSCL segments.
 *
 * Endpoints become one node when they coincide (after rounding) or lie within
 * a small merge tolerance AND share a CSCL vertical level, so a bridge deck
 * never connects to the street beneath it. The representative of a merged
 * group is its smallest key, so node identity never depends on input order.
 *
 * Borrowed concept: BoundlessNYC clusters near-miss CSCL endpoints with
 * union-find so its traffic graph does not shatter. Here the tolerance is kept
 * small (0.5 m by default) because a scientific substrate should prefer an
 * honest gap to a fabricated connection; every merge is counted.
 */
export interface GraphBuildResult {
  nodes: Map<string, StreetGraphNode & { xy: XY }>;
  edges: StreetGraphEdge[];
  segmentNodes: Map<string, [string, string]>;
  stats: { endpoints: number; mergedEndpoints: number; maxMergeDistanceM: number; boundaryNodes: number; selfLoops: number };
}

type Segment = Pick<StreetSegmentFeature, "id" | "geometry" | "levelCodes" | "lengthM" | "roadClass" | "trafficDirection">;

function endpointKey(position: Position, level: string | null): string {
  return `${Math.round(position[0] * 1e7)}:${Math.round(position[1] * 1e7)}:${level ?? "na"}`;
}

const GRADE_SEPARATED_CLASSES = new Set(["bridge", "tunnel"]);

export function buildStreetGraph(
  segments: Segment[],
  options: {
    mergeToleranceM: number;
    elevationAt: (x: number, y: number) => number | null;
    inCoverage: (xy: XY) => boolean;
    /** Physical source segments NOT compiled (outside coverage); they mark truncated nodes. */
    excluded: Segment[];
  },
): GraphBuildResult {
  type Key = { key: string; xy: XY; position: Position; level: string | null; real: boolean };
  const keys = new Map<string, Key>();
  const addEndpoint = (position: Position, level: string | null, real: boolean) => {
    const key = endpointKey(position, level);
    const existing = keys.get(key);
    if (existing) existing.real ||= real;
    else keys.set(key, { key, xy: toLocal(position[0], position[1]), position: [position[0], position[1]], level, real });
    return key;
  };
  const ends = (segment: Segment): [Position, Position] => {
    const coords = segment.geometry.coordinates as Position[];
    return [coords[0], coords[coords.length - 1]];
  };
  const segmentKeys = new Map<string, [string, string]>();
  for (const segment of segments) {
    const [a, b] = ends(segment);
    segmentKeys.set(segment.id, [addEndpoint(a, segment.levelCodes[0], true), addEndpoint(b, segment.levelCodes[1], true)]);
  }
  for (const segment of options.excluded) {
    const [a, b] = ends(segment);
    addEndpoint(a, segment.levelCodes[0], false);
    addEndpoint(b, segment.levelCodes[1], false);
  }

  // Union-find over keys within tolerance on the same level.
  const sorted = [...keys.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parent = new Map(sorted.map((k) => [k.key, k.key]));
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cursor = key;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      if (ra < rb) parent.set(rb, ra);
      else parent.set(ra, rb);
    }
  };
  const tolerance = options.mergeToleranceM;
  const cell = Math.max(tolerance, 1e-6);
  const grid = new Map<string, Key[]>();
  const cellOf = ([x, y]: XY) => [Math.floor(x / cell), Math.floor(y / cell)];
  for (const k of sorted) {
    const [cx, cy] = cellOf(k.xy);
    const id = `${cx}:${cy}`;
    const list = grid.get(id);
    if (list) list.push(k);
    else grid.set(id, [k]);
  }
  let mergedEndpoints = 0;
  let maxMergeDistanceM = 0;
  for (const k of sorted) {
    const [cx, cy] = cellOf(k.xy);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (const other of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (other.key <= k.key || other.level !== k.level) continue;
          const ex = other.xy[0] - k.xy[0];
          const ey = other.xy[1] - k.xy[1];
          const distance = Math.sqrt(ex * ex + ey * ey);
          if (distance <= tolerance && find(other.key) !== find(k.key)) {
            union(other.key, k.key);
            if (k.real && other.real) {
              mergedEndpoints += 1;
              if (distance > maxMergeDistanceM) maxMergeDistanceM = distance;
            }
          }
        }
      }
    }
  }

  // Representative of each group: its smallest REAL key, so ghosts never name a node.
  const groups = new Map<string, Key[]>();
  for (const k of sorted) {
    const root = find(k.key);
    const list = groups.get(root);
    if (list) list.push(k);
    else groups.set(root, [k]);
  }
  const nodeOfKey = new Map<string, string>();
  const nodes = new Map<string, StreetGraphNode & { xy: XY }>();
  for (const members of groups.values()) {
    const real = members.filter((m) => m.real);
    if (real.length === 0) continue;
    const representative = real[0];
    const id = `node:${representative.key}`;
    for (const m of members) nodeOfKey.set(m.key, id);
    const atGrade = representative.level === AT_GRADE_LEVEL;
    nodes.set(id, {
      id,
      position: representative.position,
      kind: "endpoint",
      degree: 0,
      levelCode: representative.level,
      elevationM: atGrade ? options.elevationAt(representative.xy[0], representative.xy[1]) : null,
      boundary: members.some((m) => !m.real) || !options.inCoverage(representative.xy),
      xy: representative.xy,
    });
  }

  const edges: StreetGraphEdge[] = [];
  const segmentNodes = new Map<string, [string, string]>();
  let selfLoops = 0;
  for (const segment of segments) {
    const [ka, kb] = segmentKeys.get(segment.id)!;
    const from = nodeOfKey.get(ka)!;
    const to = nodeOfKey.get(kb)!;
    segmentNodes.set(segment.id, [from, to]);
    nodes.get(from)!.degree += 1;
    nodes.get(to)!.degree += 1;
    if (from === to) selfLoops += 1;
    const a = nodes.get(from)!;
    const b = nodes.get(to)!;
    const gradeSeparated = segment.levelCodes[0] !== AT_GRADE_LEVEL || segment.levelCodes[1] !== AT_GRADE_LEVEL || GRADE_SEPARATED_CLASSES.has(segment.roadClass);
    const slope =
      !gradeSeparated && a.elevationM !== null && b.elevationM !== null && segment.lengthM > 0
        ? roundTo((b.elevationM - a.elevationM) / segment.lengthM, 4)
        : null;
    edges.push({
      id: `edge:${segment.id.replace(/^street:/, "")}`,
      segmentId: segment.id,
      from,
      to,
      lengthM: segment.lengthM,
      roadClass: segment.roadClass,
      trafficDirection: segment.trafficDirection,
      gradeSeparated,
      slope,
    });
  }
  for (const node of nodes.values()) {
    const kind: GraphNodeKind = node.degree >= 3 ? "intersection" : node.degree === 1 ? "endpoint" : "continuation";
    node.kind = kind;
  }
  edges.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return {
    nodes,
    edges,
    segmentNodes,
    stats: {
      endpoints: segments.length * 2,
      mergedEndpoints,
      maxMergeDistanceM: roundTo(maxMergeDistanceM, 3),
      boundaryNodes: [...nodes.values()].filter((n) => n.boundary).length,
      selfLoops,
    },
  };
}
