import { describe, it, expect } from "vitest";
import {
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  assessScenario,
  formatCompactUSD,
  formatVolumeM3,
  hasActiveInterventions,
  normalizeScenario,
  projectScore,
  type Scenario,
} from "./scenario";
import { computeAbsorptionScore } from "./absorption";
import type { LandCover } from "./types";

const cover = (partial: Partial<LandCover>): LandCover => ({
  pavement: 0,
  buildings: 0,
  vegetation: 0,
  water: 0,
  soil: 0,
  ...partial,
});

const scenario = (partial: Partial<Scenario>): Scenario => ({
  ...EMPTY_SCENARIO,
  ...partial,
});

describe("normalizeScenario", () => {
  it("clamps fractions into [0, 1]", () => {
    const n = normalizeScenario(
      scenario({ street_trees: -1, green_roofs: 2, bioswales: NaN })
    );
    expect(n.street_trees).toBe(0);
    expect(n.green_roofs).toBe(1);
    expect(n.bioswales).toBe(0);
  });

  it("scales same-source interventions so no class is over-converted", () => {
    const n = normalizeScenario(
      scenario({ street_trees: 0.7, bioswales: 0.6 })
    );
    // 0.7 + 0.6 = 1.3 of pavement — scaled down to exactly 1.0 total.
    expect(n.street_trees + n.bioswales).toBeCloseTo(1, 10);
    expect(n.street_trees / n.bioswales).toBeCloseTo(0.7 / 0.6, 10);
  });

  it("does not touch interventions on different source classes", () => {
    const n = normalizeScenario(
      scenario({ street_trees: 0.9, green_roofs: 0.9 })
    );
    expect(n.street_trees).toBe(0.9);
    expect(n.green_roofs).toBe(0.9);
  });
});

describe("projectScore", () => {
  it("matches the base score when the scenario is empty", () => {
    const c = cover({ pavement: 40, vegetation: 30, buildings: 20, soil: 10 });
    expect(projectScore(c, EMPTY_SCENARIO)).toBe(computeAbsorptionScore(c));
  });

  it("lifts an all-pavement tile to 100 with full depaving", () => {
    const c = cover({ pavement: 100 });
    expect(projectScore(c, scenario({ street_trees: 1 }))).toBe(100);
  });

  it("applies the documented delta: share × fraction × weight gap", () => {
    // 100% pavement, 50% converted to trees: 5 + 0.5 × (1.0 − 0.05) × 100 = 52.5
    const c = cover({ pavement: 100 });
    expect(projectScore(c, scenario({ street_trees: 0.5 }))).toBe(52.5);
  });

  it("only affects the intervention's source class", () => {
    // No buildings → green roofs change nothing.
    const c = cover({ pavement: 60, vegetation: 40 });
    expect(projectScore(c, scenario({ green_roofs: 1 }))).toBe(
      computeAbsorptionScore(c)
    );
  });

  it("normalizes covers that do not sum to 100", () => {
    const a = projectScore(
      cover({ pavement: 50, vegetation: 50 }),
      scenario({ bioswales: 0.4 })
    );
    const b = projectScore(
      cover({ pavement: 25, vegetation: 25 }),
      scenario({ bioswales: 0.4 })
    );
    expect(a).toBe(b);
  });

  it("caps over-converted scenarios at full conversion of the class", () => {
    const c = cover({ pavement: 100 });
    const capped = projectScore(
      c,
      scenario({ street_trees: 1, bioswales: 1 })
    );
    // Half trees (1.0), half bioswales (0.9) → 95.
    expect(capped).toBe(95);
  });
});

describe("assessScenario", () => {
  it("computes retention, capex, benefit, and payback for a known case", () => {
    // 1 km² of pure pavement, half depaved to trees, 1000 mm rainfall.
    const impact = assessScenario(
      cover({ pavement: 100 }),
      scenario({ street_trees: 0.5 }),
      1_000_000,
      { annualRainfallMm: 1000, benefitPerM3USD: 2.5 }
    );
    expect(impact.baseScore).toBe(5);
    expect(impact.projectedScore).toBe(52.5);
    expect(impact.scoreDelta).toBe(47.5);
    expect(impact.baseRisk).toBe("high");
    expect(impact.projectedRisk).toBe("moderate");
    // 500,000 m² converted at $45/m².
    expect(impact.convertedAreaM2.street_trees).toBeCloseTo(500_000, 3);
    expect(impact.capexUSD).toBeCloseTo(22_500_000, 0);
    // 1e6 m² × 1000 mm × 0.475 = 475,000 m³/yr.
    expect(impact.addedRetentionM3).toBeCloseTo(475_000, 0);
    expect(impact.annualBenefitUSD).toBeCloseTo(1_187_500, 0);
    expect(impact.paybackYears).toBeCloseTo(22_500_000 / 1_187_500, 6);
  });

  it("still projects scores when the site area is unknown", () => {
    const impact = assessScenario(
      cover({ pavement: 100 }),
      scenario({ street_trees: 1 }),
      0
    );
    expect(impact.projectedScore).toBe(100);
    expect(impact.capexUSD).toBe(0);
    expect(impact.addedRetentionM3).toBe(0);
    expect(impact.paybackYears).toBeNull();
  });

  it("returns a null payback for an empty scenario", () => {
    const impact = assessScenario(
      cover({ pavement: 50, vegetation: 50 }),
      EMPTY_SCENARIO,
      10_000
    );
    expect(impact.scoreDelta).toBe(0);
    expect(impact.paybackYears).toBeNull();
  });
});

describe("intervention catalog", () => {
  it("keeps every target weight within the physical 0–1 range", () => {
    for (const key of INTERVENTION_ORDER) {
      expect(INTERVENTIONS[key].targetWeight).toBeGreaterThan(0);
      expect(INTERVENTIONS[key].targetWeight).toBeLessThanOrEqual(1);
      expect(INTERVENTIONS[key].unitCostUSD).toBeGreaterThan(0);
    }
  });
});

describe("formatting helpers", () => {
  it("detects active interventions", () => {
    expect(hasActiveInterventions(EMPTY_SCENARIO)).toBe(false);
    expect(hasActiveInterventions(scenario({ green_roofs: 0.1 }))).toBe(true);
  });

  it("formats compact currency", () => {
    expect(formatCompactUSD(95)).toBe("$95");
    expect(formatCompactUSD(1_200_000)).toBe("$1.2M");
    expect(formatCompactUSD(NaN)).toBe("—");
  });

  it("formats volumes", () => {
    expect(formatVolumeM3(475_000)).toBe("475,000 m³");
    expect(formatVolumeM3(12.34)).toBe("12.3 m³");
  });
});
