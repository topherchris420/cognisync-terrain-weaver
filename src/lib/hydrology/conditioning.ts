/**
 * Depression filling before D8 routing: Priority-Flood with an ε gradient
 * (Barnes, Lehman & Mulla 2014, "Priority-Flood: An optimal
 * depression-filling and watershed-labeling algorithm", Computers &
 * Geosciences 62).
 *
 * Why: routing/R1 showed unconditioned D8 stops water in single-cell pits and
 * cannot move it across flats; routing/R2 showed a median 81% of routed water
 * ending in interior pits on observed terrain at high resolution. Filling
 * treats every closed depression as full, so water spills onward to the
 * extent boundary along the lowest path, and filled flats carry a tiny
 * gradient toward their outlet.
 *
 * What it gives up: depression storage. Water that would pond in a real
 * depression until it fills is instead passed through. The engine's reported
 * volumes are unchanged; only where water is routed changes.
 */

/** Rise per step across a filled flat, metres. Far below any DEM precision. */
export const FILL_EPSILON_M = 1e-4;

class MinHeap {
  private items: Array<[number, number, number]> = []; // [elevation, sequence, index]
  get size() {
    return this.items.length;
  }
  push(item: [number, number, number]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  // Ties break by insertion order so the result is deterministic everywhere.
  private less(x: [number, number, number], y: [number, number, number]) {
    return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
  }
}

/**
 * Cells at or below this elevation are receiving tidal water: water reaching
 * them has left the land system, as at the extent boundary. Terrarium blends
 * bathymetry and contains spurious values down to −14 km along NYC shorelines
 * (experiments/PREREGISTRATION.md, Addendum 3); treating them as outlets
 * stops each from acting as a bottomless reservoir.
 */
export const RECEIVING_WATER_MAX_ELEVATION_M = 0;

export function isReceivingWater(elevation: number): boolean {
  return elevation <= RECEIVING_WATER_MAX_ELEVATION_M;
}

export function fillDepressions(
  values: number[][],
  epsilon = FILL_EPSILON_M,
  outlet: (row: number, col: number) => boolean = () => false,
): number[][] {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const out = values.map((row) => [...row]);
  const closed = new Uint8Array(rows * cols);
  const heap = new MinHeap();
  let sequence = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || outlet(r, c)) {
        closed[r * cols + c] = 1;
        heap.push([out[r][c], sequence++, r * cols + c]);
      }
    }
  }
  while (heap.size) {
    const [level, , index] = heap.pop();
    const r = Math.floor(index / cols);
    const c = index % cols;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const nr = r + dr;
        const nc = c + dc;
        if ((dr === 0 && dc === 0) || nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (closed[ni]) continue;
        closed[ni] = 1;
        if (out[nr][nc] <= level + epsilon) out[nr][nc] = level + epsilon;
        heap.push([out[nr][nc], sequence++, ni]);
      }
    }
  }
  return out;
}

export interface FillSpillResult {
  /** Next cell for each cell; a cell that is its own receiver is a sink (boundary outlet or depression bottom). */
  receivers: [number, number][][];
  /** Water passing through each cell. Depression bottoms show inflow before storage. */
  accumulation: number[][];
  /** Water leaving the extent at each boundary outlet. */
  outflow: number[][];
  /** Static ponded depth (m) at the end of the event: depression water level minus ground. */
  pondDepthM: number[][];
  pondedVolume: number;
  outflowVolume: number;
  depressionCount: number;
  depressionCapacity: number;
}

const D8: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

function steepestReceiver(
  z: number[][],
  row: number,
  col: number,
  allowed: (r: number, c: number) => boolean = () => true,
): [number, number] {
  const rows = z.length;
  const cols = z[0].length;
  let best = 0;
  let receiver: [number, number] = [row, col];
  for (const [dr, dc] of D8) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= rows || c >= cols || !allowed(r, c)) continue;
    const slope = (z[row][col] - z[r][c]) / (dr === 0 || dc === 0 ? 1 : Math.SQRT2);
    if (slope > best) {
      best = slope;
      receiver = [r, c];
    }
  }
  return receiver;
}

/**
 * Static fill-and-spill routing (a simplified form of Barnes, Callaghan &
 * Wickert 2020, "Computing water flow through complex landscapes").
 *
 * Every closed depression — a connected set of cells that exact filling
 * raises — becomes a reservoir with its volume below the spill level. Water
 * follows the real terrain everywhere: outside depressions toward neighbours
 * that are also lower on the ε-filled surface (so the pour point drains
 * outward), inside depressions down to the bottom. Each reservoir keeps what
 * it can hold and passes only the excess to the cell beyond its spill point.
 * Reservoir outflow always lands strictly below the spill level, so the flow
 * graph is acyclic; cells are processed in topological order.
 *
 * A one-cell pit therefore overflows almost at once, while a real bowl holds
 * a small storm entirely.
 *
 * Cells at or below 0 m are receiving water and act as outlets.
 *
 * Simplifications, stated: nested depressions are merged into one reservoir
 * with one water level; storage fills within a single event with no timing;
 * ponds neither infiltrate nor evaporate; no sewer inlets drain them.
 */
export function fillAndSpill(elevation: number[][], generated: number[][], cellAreaM2: number): FillSpillResult {
  const rows = elevation.length;
  const cols = elevation[0]?.length ?? 0;
  const cells = rows * cols;
  const water = (r: number, c: number) => isReceivingWater(elevation[r][c]);
  const spill = fillDepressions(elevation, 0, water);
  const directed = fillDepressions(elevation, FILL_EPSILON_M, water);
  const region = new Int32Array(cells).fill(-1);
  const capacity: number[] = [];
  const members: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const start = r * cols + c;
      if (region[start] !== -1 || spill[r][c] - elevation[r][c] <= 1e-9) continue;
      const id = capacity.length;
      capacity.push(0);
      members.push([]);
      const stack = [start];
      region[start] = id;
      while (stack.length) {
        const index = stack.pop()!;
        const rr = Math.floor(index / cols);
        const cc = index % cols;
        capacity[id] += (spill[rr][cc] - elevation[rr][cc]) * cellAreaM2;
        members[id].push(index);
        for (const [dr, dc] of D8) {
          const nr = rr + dr;
          const nc = cc + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (region[ni] === -1 && spill[nr][nc] - elevation[nr][nc] > 1e-9) {
            region[ni] = id;
            stack.push(ni);
          }
        }
      }
    }
  }

  const receivers = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c): [number, number] => {
      if (water(r, c)) return [r, c];
      const id = region[r * cols + c];
      if (id >= 0) {
        // Inside a depression: downhill on real terrain, staying in the depression.
        return steepestReceiver(elevation, r, c, (nr, nc) => region[nr * cols + nc] === id);
      }
      const terrain = steepestReceiver(elevation, r, c, (nr, nc) => directed[nr][nc] < directed[r][c]);
      return terrain[0] !== r || terrain[1] !== c ? terrain : steepestReceiver(directed, r, c);
    }),
  );

  // Each reservoir spills where the ε-filled surface first drops strictly
  // below its spill level (or reaches an outlet). Rim cells a hair above the
  // spill level are passed over: they may drain back into the depression, and
  // choosing one would create a cycle. Below the spill level every further step
  // descends, so water can never re-enter this depression.
  const spillTarget = members.map((cellsOfRegion) => {
    const level = spill[Math.floor(cellsOfRegion[0] / cols)][cellsOfRegion[0] % cols];
    let index = cellsOfRegion[0];
    for (let guard = 0; guard <= cells; guard += 1) {
      const [nr, nc] = steepestReceiver(directed, Math.floor(index / cols), index % cols);
      const next = nr * cols + nc;
      if (next === index) return index === cellsOfRegion[0] ? -1 : index;
      if (region[next] === -1 && (directed[nr][nc] < level || water(nr, nc))) return next;
      index = next;
    }
    return -1;
  });

  // Nodes 0..cells-1 are cells; cells + id is reservoir id.
  const nodes = cells + capacity.length;
  const downstream = new Int32Array(nodes).fill(-1);
  for (let index = 0; index < cells; index += 1) {
    const [nr, nc] = receivers[Math.floor(index / cols)][index % cols];
    const next = nr * cols + nc;
    if (next !== index) downstream[index] = next;
    else if (region[index] >= 0) downstream[index] = cells + region[index];
  }
  spillTarget.forEach((target, id) => {
    downstream[cells + id] = target;
  });
  const indegree = new Int32Array(nodes);
  for (let node = 0; node < nodes; node += 1) if (downstream[node] >= 0) indegree[downstream[node]] += 1;
  const queue: number[] = [];
  for (let node = 0; node < nodes; node += 1) if (indegree[node] === 0) queue.push(node);

  const volume = new Float64Array(nodes);
  for (let index = 0; index < cells; index += 1) volume[index] = generated[Math.floor(index / cols)][index % cols];
  const accumulation = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const outflow = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const stored = capacity.map(() => 0);
  let processed = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    processed += 1;
    let passing = volume[node];
    if (node >= cells) {
      const id = node - cells;
      const take = Math.min(capacity[id], passing);
      stored[id] = take;
      passing -= take;
    } else {
      accumulation[Math.floor(node / cols)][node % cols] = passing;
    }
    const next = downstream[node];
    if (next >= 0) {
      volume[next] += passing;
      indegree[next] -= 1;
      if (indegree[next] === 0) queue.push(next);
    } else if (node < cells) {
      outflow[Math.floor(node / cols)][node % cols] = passing;
    } else if (passing > 0) {
      // A reservoir spilling across the boundary: attribute to its lowest rim cell.
      const rim = members[node - cells][0];
      outflow[Math.floor(rim / cols)][rim % cols] += passing;
    }
  }
  if (processed !== nodes) throw new Error("Fill-and-spill flow graph contains a cycle.");

  const pondDepthM = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  stored.forEach((held, id) => {
    if (held <= 0) return;
    // Water level h with Σ max(0, h − z)·A = held over the depression's
    // cells: with the k+1 lowest cells wet, held/A = (k+1)·h − Σ z.
    const ground = members[id].map((i) => elevation[Math.floor(i / cols)][i % cols]).sort((a, b) => a - b);
    const depth = held / cellAreaM2;
    let prefix = 0;
    let level = ground[0];
    for (let k = 0; k < ground.length; k += 1) {
      prefix += ground[k];
      level = (depth + prefix) / (k + 1);
      if (k + 1 === ground.length || level <= ground[k + 1]) break;
    }
    for (const i of members[id]) {
      const rr = Math.floor(i / cols);
      const cc = i % cols;
      pondDepthM[rr][cc] = Math.max(0, level - elevation[rr][cc]);
    }
  });
  const pondedVolume = stored.reduce((sum, v) => sum + v, 0);
  return {
    receivers,
    accumulation,
    outflow,
    pondDepthM,
    pondedVolume,
    outflowVolume: outflow.flat().reduce((sum, v) => sum + v, 0),
    depressionCount: capacity.length,
    depressionCapacity: capacity.reduce((sum, v) => sum + v, 0),
  };
}
