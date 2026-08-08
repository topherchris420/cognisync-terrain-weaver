import { describe, expect, it, beforeEach } from "vitest";
import {
  CATALYST_STORAGE_KEY,
  DEFAULT_TARGET_SCORE,
  evaluateVerdict,
  isCatalystUnlocked,
  projectFuture,
  relockCatalyst,
  solveForTarget,
  unlockCatalyst,
} from "./catalyst";
import { computeAbsorptionScore } from "./absorption";
import { projectScore, INTERVENTIONS, EMPTY_SCENARIO } from "./scenario";
import type { LandCover } from "./types";

const MIDTOWN: LandCover = {
  pavement: 44,
  buildings: 47,
  vegetation: 6,
  soil: 1,
  water: 2,
};

const PARK: LandCover = {
  pavement: 8,
  buildings: 2,
  vegetation: 82,
  soil: 6,
  water: 2,
};

describe("unlock persistence", () => {
  beforeEach(() => relockCatalyst());

  it("starts locked and persists a single unlock", () => {
    expect(isCatalystUnlocked()).toBe(false);
    unlockCatalyst();
    expect(isCatalystUnlocked()).toBe(true);
    expect(window.localStorage.getItem(CATALYST_STORAGE_KEY)).toBe("1");
  });

  it("announces the unlock so every mounted lens opens together", () => {
    let heard: boolean | null = null;
    const listener = (e: Event) => {
      heard = (e as CustomEvent<boolean>).detail;
    };
    window.addEventListener("mannahatta:catalyst-unlock", listener);
    unlockCatalyst();
    window.removeEventListener("mannahatta:catalyst-unlock", listener);
    expect(heard).toBe(true);
  });
});

describe("solveForTarget", () => {
  it("reaches the target it claims to reach, verified by the shared scorer", () => {
    const r = solveForTarget(MIDTOWN, DEFAULT_TARGET_SCORE);
    expect(r.reachable).toBe(true);
    expect(projectScore(MIDTOWN, r.scenario)).toBe(r.achievedScore);
    expect(r.achievedScore).toBeGreaterThanOrEqual(DEFAULT_TARGET_SCORE - 0.05);
  });

  it("does nothing when the ground already meets the target", () => {
    const r = solveForTarget(PARK, 40);
    expect(r.scenario).toEqual(EMPTY_SCENARIO);
    expect(r.baseScore).toBeGreaterThan(40);
    expect(r.reachable).toBe(true);
  });

  it("spends the cheapest score-per-dollar option first", () => {
    const r = solveForTarget(MIDTOWN, 30);
    // Street trees carry the highest lift per dollar of any option.
    expect(r.used[0]).toBe("street_trees");
    expect(r.scenario.permeable_pavement).toBe(0);
  });

  it("reports an unreachable target honestly rather than overshooting", () => {
    const r = solveForTarget(MIDTOWN, 95);
    expect(r.reachable).toBe(false);
    expect(r.ceilingScore).toBeLessThan(95);
    expect(r.achievedScore).toBeLessThanOrEqual(r.ceilingScore + 0.05);
  });

  it("never converts more than 100% of any source class", () => {
    const r = solveForTarget(MIDTOWN, 100);
    const pavementSpend =
      r.scenario.street_trees + r.scenario.bioswales + r.scenario.permeable_pavement;
    expect(pavementSpend).toBeLessThanOrEqual(1.0000001);
    expect(r.scenario.green_roofs).toBeLessThanOrEqual(1);
    expect(INTERVENTIONS.green_roofs.source).toBe("buildings");
  });
});

describe("evaluateVerdict", () => {
  it("never claims proof — only support under the simulation", () => {
    expect(evaluateVerdict(45, 40)).toBe("supported");
    expect(evaluateVerdict(30, 40)).toBe("not_supported");
    expect(evaluateVerdict(40.5, 40)).toBe("inconclusive");
  });
});

describe("projectFuture", () => {
  const areaM2 = 1_000_000;

  it("moves depaved surface into vegetation and leaves the tile at 100%", () => {
    const f = projectFuture(MIDTOWN, { ...EMPTY_SCENARIO, street_trees: 0.5 }, areaM2);
    expect(f.cover.pavement).toBeCloseTo(22, 5);
    expect(f.cover.vegetation).toBeCloseTo(28, 5);
    const total = Object.values(f.cover).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("keeps green roofs as buildings and reports them as re-engineered", () => {
    const f = projectFuture(MIDTOWN, { ...EMPTY_SCENARIO, green_roofs: 0.5 }, areaM2);
    expect(f.cover.buildings).toBe(MIDTOWN.buildings);
    expect(f.engineeredPct).toBeCloseTo(23.5, 1);
    expect(f.impact.projectedScore).toBeGreaterThan(f.impact.baseScore);
  });

  it("cuts runoff exactly as much as the score raises retention", () => {
    const f = projectFuture(MIDTOWN, { ...EMPTY_SCENARIO, bioswales: 0.4 }, areaM2);
    const avoided = f.runoffBeforeM3 - f.runoffAfterM3;
    expect(avoided).toBeCloseTo(f.impact.addedRetentionM3, 4);
  });

  it("borrows the live scorer rather than restating it", () => {
    const f = projectFuture(MIDTOWN, EMPTY_SCENARIO, areaM2);
    expect(f.impact.baseScore).toBeCloseTo(computeAbsorptionScore(MIDTOWN), 1);
  });
});