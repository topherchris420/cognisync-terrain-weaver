import { describe, expect, it } from "vitest";
import { fillAndSpill, fillDepressions } from "./conditioning";

const grid = (n: number, f: (r: number, c: number) => number) =>
  Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => f(r, c)));
const ones = (n: number) => grid(n, () => 1);
const sum = (g: number[][]) => g.flat().reduce((a, b) => a + b, 0);

describe("depression filling", () => {
  it("raises a pit to its spill level and leaves a plane untouched", () => {
    const plane = grid(7, (_r, c) => c);
    const pit = plane.map((row, r) => row.map((v, c) => (r === 3 && c === 3 ? -5 : v)));
    expect(fillDepressions(plane, 0)).toEqual(plane);
    const filled = fillDepressions(pit, 0);
    expect(filled[3][3]).toBe(2);
    expect(filled[3][4]).toBe(4);
  });

  it("gives a flat a drainage gradient toward the boundary", () => {
    const filled = fillDepressions(grid(5, () => 0));
    expect(filled[2][2]).toBeGreaterThan(filled[1][2]);
    expect(filled[1][2]).toBeGreaterThan(filled[0][2]);
    expect(filled[2][2] - filled[0][2]).toBeLessThan(1e-3);
  });
});

describe("fill-and-spill", () => {
  it("conserves water: outflow + ponded = generated", () => {
    const bumpy = grid(15, (r, c) => 10 + Math.sin(r * 1.3) * 2 + Math.cos(c * 0.7) * 3 + c * 0.2);
    const result = fillAndSpill(bumpy, ones(15), 1);
    expect(result.outflowVolume + result.pondedVolume).toBeCloseTo(225, 9);
    expect(result.pondedVolume).toBeLessThanOrEqual(result.depressionCapacity + 1e-9);
  });

  it("lets a shallow pit overflow but a deep bowl hold a small storm", () => {
    const pit = grid(9, (r, c) => (r === 4 && c === 4 ? c - 1.5 : c)); // 0.5 m below its lowest neighbour
    const spilled = fillAndSpill(pit, ones(9), 1);
    expect(spilled.pondedVolume).toBeCloseTo(0.5, 9);
    expect(spilled.outflowVolume).toBeCloseTo(80.5, 9);

    const bowl = grid(9, (r, c) => 1 + (r - 4) ** 2 + (c - 4) ** 2);
    const held = fillAndSpill(bowl, ones(9), 1);
    // Only rain on the four pour points (rim midpoints at the spill level) leaves;
    // the rim drains into the bowl, which has far more capacity than 77 units.
    expect(held.outflowVolume).toBeCloseTo(4, 9);
    expect(held.pondedVolume).toBeCloseTo(77, 9);
  });

  it("solves a pond level that stores exactly the retained volume", () => {
    const bowl = grid(9, (r, c) => 1 + (r - 4) ** 2 + (c - 4) ** 2);
    const cellArea = 2;
    const result = fillAndSpill(bowl, ones(9), cellArea);
    expect(sum(result.pondDepthM) * cellArea).toBeCloseTo(result.pondedVolume, 6);
    expect(result.pondDepthM[4][4]).toBeGreaterThan(result.pondDepthM[4][5]);
  });

  it("is deterministic", () => {
    const g = grid(12, (r, c) => ((r * 7 + c * 13) % 5) - r * 0.1);
    expect(fillAndSpill(g, ones(12), 1)).toEqual(fillAndSpill(g, ones(12), 1));
  });
});

describe("receiving-water boundary", () => {
  it("drains water into sub-sea-level cells instead of storing it in spurious deep pixels", () => {
    // A land slope with one spurious −900 m pixel, as found in Terrarium tiles.
    const spiked = grid(9, (r, c) => (r === 4 && c === 4 ? -900 : 5 + c));
    const result = fillAndSpill(spiked, ones(9), 1);
    expect(result.depressionCapacity).toBe(0);
    expect(result.pondedVolume).toBe(0);
    expect(result.outflow[4][4]).toBeGreaterThan(1);
    expect(result.outflowVolume).toBeCloseTo(81, 9);
  });
});
