import { describe, it, expect } from "vitest";
import {
  RUNOFF_COEFFICIENT,
  MAX_SIMULATION_AREA_KM2,
  boundsToSimBBox,
  runoffCoefficient,
  estimateRunoffVolumeM3,
  getFlowColor,
} from "./simulation";
import { bboxAreaKm2, type BBox } from "./geo";
import type { LandCover } from "./types";

// A ~1km-ish box near Manhattan used across the volume tests.
const BOX: BBox = [
  [-74.0, 40.75],
  [-73.99, 40.76],
];

const cover = (partial: Partial<LandCover> = {}): LandCover => ({
  pavement: 0,
  buildings: 0,
  vegetation: 0,
  water: 0,
  soil: 0,
  ...partial,
});

describe("boundsToSimBBox", () => {
  it("maps [[w,s],[e,n]] to {north,south,east,west}", () => {
    expect(boundsToSimBBox(BOX)).toEqual({
      north: 40.76,
      south: 40.75,
      east: -73.99,
      west: -74.0,
    });
  });
});

describe("runoffCoefficient", () => {
  it("returns 0 for an empty cover mix", () => {
    expect(runoffCoefficient(cover())).toBe(0);
  });

  it("returns the class coefficient for a single-class tile", () => {
    expect(runoffCoefficient(cover({ pavement: 100 }))).toBeCloseTo(
      RUNOFF_COEFFICIENT.pavement,
      5
    );
    expect(runoffCoefficient(cover({ vegetation: 100 }))).toBeCloseTo(
      RUNOFF_COEFFICIENT.vegetation,
      5
    );
  });

  it("is share-weighted between classes", () => {
    const c = runoffCoefficient(cover({ pavement: 50, vegetation: 50 }));
    expect(c).toBeCloseTo(
      (RUNOFF_COEFFICIENT.pavement + RUNOFF_COEFFICIENT.vegetation) / 2,
      5
    );
  });

  it("normalizes when shares don't sum to 100", () => {
    // Only 40% of the tile is classified; the coefficient is over what's there.
    expect(runoffCoefficient(cover({ pavement: 20, vegetation: 20 }))).toBeCloseTo(
      (RUNOFF_COEFFICIENT.pavement + RUNOFF_COEFFICIENT.vegetation) / 2,
      5
    );
  });

  it("impervious cover runs off more than vegetated cover", () => {
    expect(runoffCoefficient(cover({ pavement: 100 }))).toBeGreaterThan(
      runoffCoefficient(cover({ vegetation: 100 }))
    );
  });

  it("stays within 0–1", () => {
    const c = runoffCoefficient(
      cover({ pavement: 40, buildings: 30, vegetation: 20, soil: 10 })
    );
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("estimateRunoffVolumeM3", () => {
  it("is zero when there is no rain", () => {
    expect(estimateRunoffVolumeM3(cover({ pavement: 100 }), 0, BOX)).toBe(0);
  });

  it("matches V = rainfall_m x C x area_m2", () => {
    const rainfallMm = 50;
    const areaM2 = bboxAreaKm2(BOX) * 1e6;
    const expected = (rainfallMm / 1000) * RUNOFF_COEFFICIENT.pavement * areaM2;
    expect(estimateRunoffVolumeM3(cover({ pavement: 100 }), rainfallMm, BOX)).toBeCloseTo(
      expected,
      3
    );
  });

  it("scales linearly with rainfall", () => {
    const c = cover({ pavement: 60, vegetation: 40 });
    const v50 = estimateRunoffVolumeM3(c, 50, BOX);
    const v100 = estimateRunoffVolumeM3(c, 100, BOX);
    expect(v100).toBeCloseTo(v50 * 2, 3);
  });

  it("more impervious tiles shed more volume for the same storm", () => {
    const paved = estimateRunoffVolumeM3(cover({ pavement: 100 }), 40, BOX);
    const green = estimateRunoffVolumeM3(cover({ vegetation: 100 }), 40, BOX);
    expect(paved).toBeGreaterThan(green);
  });
});

describe("getFlowColor", () => {
  it("clamps opacity into a visible range", () => {
    expect(getFlowColor(0)).toBe("rgba(59, 130, 246, 0.2)");
    expect(getFlowColor(1)).toBe("rgba(59, 130, 246, 1)");
    expect(getFlowColor(-5)).toBe("rgba(59, 130, 246, 0.2)");
    expect(getFlowColor(5)).toBe("rgba(59, 130, 246, 1)");
  });
});

describe("MAX_SIMULATION_AREA_KM2", () => {
  it("is a positive, practical cap", () => {
    expect(MAX_SIMULATION_AREA_KM2).toBeGreaterThan(1);
  });
});
