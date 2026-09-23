import { describe, expect, it } from "vitest";
import {
  SEA_FLOOR_M,
  cleanTerrariumHeights,
  decodeTerrarium,
  encodeTerrarium,
  shaveSpikes,
  spikeRadiusForTile,
} from "./terrarium-protocol";

const SIZE = 32;

function slope(): Float32Array {
  const heights = new Float32Array(SIZE * SIZE);
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      heights[row * SIZE + col] = 10 + col * 0.5;
    }
  }
  return heights;
}

describe("terrarium encoding", () => {
  it("round-trips heights to 1/256 m", () => {
    const heights = new Float32Array([-11.5, 0, 12.25, 8848.75]);
    const pixels = new Uint8ClampedArray(heights.length * 4);
    encodeTerrarium(heights, pixels);
    const decoded = decodeTerrarium(pixels);
    heights.forEach((value, index) => {
      expect(decoded[index]).toBeCloseTo(value, 2);
    });
  });
});

describe("terrarium cleanup", () => {
  it("shaves a building-sized spike and leaves the slope under it", () => {
    const heights = slope();
    const original = heights.slice();
    for (let row = 14; row < 17; row += 1) {
      for (let col = 14; col < 17; col += 1) {
        heights[row * SIZE + col] += 120;
      }
    }
    const shaved = shaveSpikes(heights, SIZE, SIZE, 3);
    expect(shaved).toBe(9);
    for (let row = 14; row < 17; row += 1) {
      for (let col = 14; col < 17; col += 1) {
        const index = row * SIZE + col;
        expect(Math.abs(heights[index] - original[index])).toBeLessThan(3);
      }
    }
  });

  it("keeps landforms wider than the window", () => {
    const heights = slope();
    for (let row = 4; row < 28; row += 1) {
      for (let col = 4; col < 28; col += 1) {
        heights[row * SIZE + col] += 40;
      }
    }
    const before = heights.slice();
    expect(shaveSpikes(heights, SIZE, SIZE, 3)).toBe(0);
    expect(heights).toEqual(before);
  });

  it("lifts the sea floor to sea level", () => {
    const heights = slope();
    heights.fill(-18, 0, SIZE * 4);
    cleanTerrariumHeights(heights, SIZE, SIZE, 1);
    expect(Math.min(...heights)).toBe(SEA_FLOOR_M);
    expect(heights[SIZE * 10 + 6]).toBe(13);
  });

  it("sizes the window to a building footprint at each zoom", () => {
    const manhattanY = (z: number) => Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + (40.71 * Math.PI) / 360)) / Math.PI) / 2) * 2 ** z);
    expect(spikeRadiusForTile(10, manhattanY(10))).toBe(1);
    expect(spikeRadiusForTile(14, manhattanY(14))).toBe(5);
    expect(spikeRadiusForTile(15, manhattanY(15))).toBe(10);
    expect(spikeRadiusForTile(18, manhattanY(18))).toBe(12);
  });
});
