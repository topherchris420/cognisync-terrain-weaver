import { describe, expect, it } from "vitest";
import { compareStorm, stormSweep } from "./paired-storm";
import { EMPTY_SCENARIO } from "./scenario";
import type { LandCover } from "./types";

const cover: LandCover = { pavement: 40, buildings: 20, vegetation: 20, soil: 10, water: 10 };
const scenario = { ...EMPTY_SCENARIO, street_trees: 0.5, green_roofs: 0.5 };

describe("paired storm rainfall budget", () => {
  it("excludes water and conserves identical rainfall in both futures", () => {
    const result = compareStorm(cover, scenario, 10_000, 50);
    expect(result.landAreaM2).toBe(9000);
    expect(result.rainfallVolumeM3).toBe(450);
    expect(result.now.retainedM3).toBeCloseTo(149);
    expect(result.possible.retainedM3).toBeCloseTo(242);
    for (const budget of [result.now, result.possible]) {
      expect(budget.runoffM3 + budget.retainedM3).toBeCloseTo(450);
    }
    expect(result.avoidedRunoffM3).toBeCloseTo(93);
  });

  it("returns identical budgets for an unchanged scenario", () => {
    const result = compareStorm(cover, EMPTY_SCENARIO, 10_000, 50);
    expect(result.now).toEqual(result.possible);
    expect(result.avoidedRunoffM3).toBe(0);
  });

  it("scales linearly with rainfall and preserves cover scale invariance", () => {
    const half = compareStorm(cover, scenario, 10_000, 25);
    const full = compareStorm(cover, scenario, 10_000, 50);
    expect(full.avoidedRunoffM3).toBeCloseTo(2 * half.avoidedRunoffM3);
    const fractions = Object.fromEntries(Object.entries(cover).map(([key, value]) => [key, value / 100])) as LandCover;
    expect(compareStorm(fractions, scenario, 10_000, 50).now.runoffM3).toBeCloseTo(full.now.runoffM3);
    expect(stormSweep(cover, scenario, 10_000).map((r) => r.rainfallMm)).toEqual([10, 25, 50, 100, 200]);
  });

  it("normalizes competing pavement conversions without double counting", () => {
    const result = compareStorm({ pavement: 100, buildings: 0, vegetation: 0, soil: 0, water: 0 }, { ...EMPTY_SCENARIO, street_trees: 1, bioswales: 1 }, 1000, 100);
    expect(result.possible.retainedM3).toBeCloseTo(85);
    expect(result.possible.runoffM3).toBeCloseTo(15);
  });

  it("returns zero volumes for dry, unknown-area and all-water sites", () => {
    const water = { pavement: 0, buildings: 0, vegetation: 0, soil: 0, water: 100 };
    for (const result of [compareStorm(cover, scenario, 1000, 0), compareStorm(cover, scenario, 0, 100), compareStorm(water, scenario, 1000, 100)]) {
      expect(result.rainfallVolumeM3).toBe(0);
      expect(result.now.runoffM3).toBe(0);
      expect(result.possible.retainedM3).toBe(0);
      expect(result.avoidedRunoffM3).toBe(0);
    }
  });

  it("keeps malformed numeric inputs finite and nonnegative", () => {
    const result = compareStorm({ pavement: -10, buildings: NaN, vegetation: Infinity, soil: 0, water: 100 }, { ...scenario, green_roofs: Infinity }, Infinity, -10);
    expect(result.landAreaM2).toBe(0);
    expect(result.rainfallVolumeM3).toBe(0);
    expect(result.now.runoffM3).toBe(0);
    expect(result.runoffReductionPercent).toBe(0);
  });
});
