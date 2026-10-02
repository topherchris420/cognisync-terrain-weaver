import { roundTo, toLonLat, quantizeLonLat, type XY } from "../projection";
import type { ElevationLattice } from "../layers/elevation";
import type { LandWaterMask } from "../layers/water";
import type { StreetGraphEdge, StreetGraphNode, SurfaceFlowEdge, SurfaceFlowNode } from "../types";

/**
 * EXPERIMENTAL urban-structure surface-flow graph.
 *
 * It connects at-grade street nodes (oriented downhill along street edges),
 * terrain low points, and open-water receivers, so that a later experiment
 * can compare raster D8 routing with routing that follows urban structure.
 *
 * It is NOT a sewer or drainage-network model: there are no pipes, catch
 * basins, inlets, capacities, volumes or timing, and nothing here predicts
 * where water goes. D8 over the elevation grid remains the app's routing
 * until this graph has its own validation evidence.
 */
export const SURFACE_FLOW_CAVEATS = [
  "Experimental structure for a future comparison with D8; not used by any routed result.",
  "Not a sewer or drainage-network model: no pipes, inlets, capacities, volumes or timing.",
  "Street grades come from sampled ground elevation at nodes; grade-separated edges are excluded.",
];

export interface SurfaceFlowBuild {
  nodes: Array<SurfaceFlowNode & { xy: XY; streetNodeId?: string }>;
  edges: Array<SurfaceFlowEdge & { ownerXY: XY; ownerStreetEdgeId?: string }>;
  stats: Record<string, number>;
}

export function buildSurfaceFlowGraph(input: {
  streetNodes: Map<string, StreetGraphNode & { xy: XY }>;
  streetEdges: StreetGraphEdge[];
  lattice: ElevationLattice;
  mask: LandWaterMask;
  inCoverage: (xy: XY) => boolean;
  receiverTileOf: (xy: XY) => string;
  flatSlope: number;
  receiverReachM: number;
  lowPointSnapM: number;
}): SurfaceFlowBuild {
  const nodes: SurfaceFlowBuild["nodes"] = [];
  const edges: SurfaceFlowBuild["edges"] = [];
  const streetIds = new Map<string, string>();
  for (const node of input.streetNodes.values()) {
    if (node.elevationM === null || !input.inCoverage(node.xy)) continue;
    const id = `sf:${node.id}`;
    streetIds.set(node.id, id);
    nodes.push({ id, kind: "street-node", position: node.position, elevationM: node.elevationM, xy: node.xy, streetNodeId: node.id });
  }

  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const edge of input.streetEdges) {
    const a = input.streetNodes.get(edge.from)!;
    const b = input.streetNodes.get(edge.to)!;
    const from = streetIds.get(edge.from);
    const to = streetIds.get(edge.to);
    if (!from || !to || edge.gradeSeparated || from === to || edge.lengthM <= 0) continue;
    const drop = a.elevationM! - b.elevationM!;
    const flat = Math.abs(drop / edge.lengthM) < input.flatSlope;
    const [high, low] = drop >= 0 ? [from, to] : [to, from];
    const [first, second] = from < to ? [from, to] : [to, from];
    edges.push({
      id: `sf:${edge.id}`,
      from: flat ? first : high,
      to: flat ? second : low,
      kind: flat ? "street-flat" : "street-downhill",
      dropM: roundTo(Math.abs(drop), 2),
      lengthM: edge.lengthM,
      ownerXY: a.xy,
      ownerStreetEdgeId: edge.id,
    });
    if (!flat) {
      outgoing.set(high, (outgoing.get(high) ?? 0) + 1);
      incoming.set(low, (incoming.get(low) ?? 0) + 1);
    }
  }

  // Open-water receivers: one per tile holding open water, at the mean of its water cells.
  const receivers = new Map<string, { sx: number; sy: number; n: number }>();
  for (let row = 0; row < input.mask.rows; row += 1) {
    for (let col = 0; col < input.mask.cols; col += 1) {
      if (input.mask.symbolAtCell(row, col) !== "W") continue;
      const xy = input.mask.cellCentre(row, col);
      const tile = input.receiverTileOf(xy);
      const acc = receivers.get(tile) ?? { sx: 0, sy: 0, n: 0 };
      acc.sx += xy[0];
      acc.sy += xy[1];
      acc.n += 1;
      receivers.set(tile, acc);
    }
  }
  const usedReceivers = new Set<string>();
  let sinks = 0;
  let sinksLinked = 0;
  for (const node of nodes) {
    if (node.kind !== "street-node" || (outgoing.get(node.id) ?? 0) > 0 || (incoming.get(node.id) ?? 0) === 0) continue;
    sinks += 1;
    const water = input.mask.nearestWater(node.xy[0], node.xy[1], input.receiverReachM);
    if (!water) continue;
    const tile = input.receiverTileOf(water);
    const receiver = `sf:receiver:${tile}`;
    usedReceivers.add(tile);
    sinksLinked += 1;
    const dx = water[0] - node.xy[0];
    const dy = water[1] - node.xy[1];
    edges.push({ id: `sf:sink:${node.streetNodeId}`, from: node.id, to: receiver, kind: "sink-to-receiver", dropM: null, lengthM: roundTo(Math.sqrt(dx * dx + dy * dy), 2), ownerXY: node.xy });
  }
  for (const tile of [...usedReceivers].sort()) {
    const acc = receivers.get(tile)!;
    const xy: XY = [acc.sx / acc.n, acc.sy / acc.n];
    nodes.push({ id: `sf:receiver:${tile}`, kind: "water-receiver", position: quantizeLonLat(toLonLat(xy[0], xy[1])), elevationM: null, xy });
  }

  // Terrain low points: land cells above 0 m strictly lower than all eight neighbours.
  const streetNodes = nodes.filter((n) => n.kind === "street-node");
  let lowPoints = 0;
  let lowPointsLinked = 0;
  const { lattice } = input;
  for (let row = 1; row < lattice.rows - 1; row += 1) {
    for (let col = 1; col < lattice.cols - 1; col += 1) {
      const value = lattice.usableCm(row, col);
      if (value === null || value <= 0) continue;
      const xy = lattice.cellCentre(row, col);
      if (input.mask.symbolAt(xy[0], xy[1]) !== "L") continue;
      let lowest = true;
      for (let dr = -1; dr <= 1 && lowest; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const neighbour = lattice.usableCm(row + dr, col + dc);
          if (neighbour === null || neighbour <= value) {
            lowest = false;
            break;
          }
        }
      }
      if (!lowest) continue;
      lowPoints += 1;
      const gi = Math.floor(xy[0] / lattice.cellM);
      const gj = Math.floor(xy[1] / lattice.cellM);
      const id = `sf:low:${lattice.cellM}m:${gi}:${gj}`;
      const elevationM = roundTo(value / 100, 2);
      nodes.push({ id, kind: "low-point", position: quantizeLonLat(toLonLat(xy[0], xy[1])), elevationM, xy });
      let nearest: (typeof streetNodes)[number] | null = null;
      let nearestDistance = input.lowPointSnapM * input.lowPointSnapM;
      for (const candidate of streetNodes) {
        const dx = candidate.xy[0] - xy[0];
        const dy = candidate.xy[1] - xy[1];
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance || (distance === nearestDistance && nearest !== null && candidate.id < nearest.id)) {
          nearestDistance = distance;
          nearest = candidate;
        }
      }
      if (!nearest) continue;
      lowPointsLinked += 1;
      const streetHigher = nearest.elevationM! >= elevationM;
      edges.push({
        id: `sf:lowlink:${lattice.cellM}m:${gi}:${gj}`,
        from: streetHigher ? nearest.id : id,
        to: streetHigher ? id : nearest.id,
        kind: "low-point-link",
        dropM: roundTo(Math.abs(nearest.elevationM! - elevationM), 2),
        lengthM: roundTo(Math.sqrt(nearestDistance), 2),
        ownerXY: xy,
      });
    }
  }

  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    nodes,
    edges,
    stats: {
      streetNodes: streetNodes.length,
      downhillEdges: edges.filter((e) => e.kind === "street-downhill").length,
      flatEdges: edges.filter((e) => e.kind === "street-flat").length,
      streetSinks: sinks,
      sinksLinkedToWater: sinksLinked,
      waterReceivers: usedReceivers.size,
      lowPoints,
      lowPointsLinked,
    },
  };
}
