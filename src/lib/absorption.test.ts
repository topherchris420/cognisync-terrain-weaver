import { describe, it, expect } from "vitest";
import {
  ABSORPTION_WEIGHTS,
  computeAbsorptionScore,
  classifyFloodRisk,
  riskColor,
  riskLabel,
} from "./absorption";
import type { LandCover } from "./types";

const cover = (partial: Partial<LandCover>): LandCover => ({
  pavement: 0,
  buildings: 0,
  vegetation: 0,
  water: 0,
  soil: 0,
  ...partial,
});

describe("computeAbsorptionScore", () => {
  it("scores a fully vegetated tile at 100", () => {
    expect(computeAbsorptionScore(cover({ vegetation: 100 }))).toBe(100);
  });

  it("scores fully impervious tiles at the impervious floor", () => {
    expect(computeAbsorptionScore(cover({ pavement: 50, buildings: 50 }))).toBe(5);
  });

  it("weights a balanced mix correctly", () => {
    // 40% vegetation (1.0) + 60% pavement (0.05) => 40 + 3 = 43
    expect(
      computeAbsorptionScore(cover({ vegetation: 40, pavement: 60 }))
    ).toBe(43);
  });

  it("normalizes covers that do not sum to 100", () => {
    // Same ratio as 40/60 above, expressed as 20/30.
    expect(
      computeAbsorptionScore(cover({ vegetation: 20, pavement: 30 }))
    ).toBe(43);
  });

  it("handles an all-zero cover without dividing by zero", () => {
    expect(computeAbsorptionScore(cover({}))).toBe(0);
  });

  it("caps water weighting at existing-capacity, not absorption", () => {
    expect(computeAbsorptionScore(cover({ water: 100 }))).toBe(
      ABSORPTION_WEIGHTS.water * 100
    );
  });

  it("rounds to one decimal place", () => {
    const score = computeAbsorptionScore(
      cover({ vegetation: 33, pavement: 33, soil: 34 })
    );
    expect(score).toBe(Math.round(score * 10) / 10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

describe("classifyFloodRisk", () => {
  it("classifies band boundaries per the documented thresholds", () => {
    expect(classifyFloodRisk(100)).toBe("low");
    expect(classifyFloodRisk(65)).toBe("low");
    expect(classifyFloodRisk(64.9)).toBe("moderate");
    expect(classifyFloodRisk(40)).toBe("moderate");
    expect(classifyFloodRisk(39.9)).toBe("high");
    expect(classifyFloodRisk(0)).toBe("high");
  });

  it("returns unknown for out-of-range scores", () => {
    expect(classifyFloodRisk(-1)).toBe("unknown");
  });
});

describe("risk presentation helpers", () => {
  it("maps each risk band to a distinct semantic color", () => {
    const colors = ["low", "moderate", "high", "unknown"].map((r) =>
      riskColor(r as Parameters<typeof riskColor>[0])
    );
    expect(new Set(colors).size).toBe(4);
  });

  it("capitalizes labels", () => {
    expect(riskLabel("low")).toBe("Low");
    expect(riskLabel("moderate")).toBe("Moderate");
    expect(riskLabel("high")).toBe("High");
  });
});
