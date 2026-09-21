import { describe, expect, it } from "vitest";
import { computeAbsorptionScore } from "./absorption";
import {
  BASELINE_COVER,
  BASELINE_SCORE,
  baselineSentence,
  compareToBaseline,
} from "./baseline";

describe("BASELINE_COVER", () => {
  it("sums to 100 percent", () => {
    const total = Object.values(BASELINE_COVER).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("has no impervious cover in 1609", () => {
    expect(BASELINE_COVER.buildings).toBe(0);
    expect(BASELINE_COVER.pavement).toBe(0);
  });
});

describe("BASELINE_SCORE", () => {
  // The comparison is only honest if the baseline goes through the same
  // scorer as a live scan. Asserting the derivation, not a hard-coded number,
  // is what keeps it that way if the weights are ever recalibrated.
  it("is derived from the shared scorer, not asserted", () => {
    expect(BASELINE_SCORE).toBe(computeAbsorptionScore(BASELINE_COVER));
  });

  it("lands below 100 — no surface absorbs all its rain", () => {
    expect(BASELINE_SCORE).toBeGreaterThan(70);
    expect(BASELINE_SCORE).toBeLessThan(85);
  });

  it("beats any real urban scan in the calibration range", () => {
    // Bois de Boulogne, the most absorbent site in the calibration set.
    expect(BASELINE_SCORE).toBeGreaterThan(74.7);
  });
});

describe("compareToBaseline", () => {
  it("reports the shortfall for a dense urban score", () => {
    const cmp = compareToBaseline(14);
    expect(cmp.meetsBaseline).toBe(false);
    expect(cmp.shortfall).toBeCloseTo(BASELINE_SCORE - 14, 1);
    expect(cmp.benchmarkPct).toBe(Math.round((14 / BASELINE_SCORE) * 100));
  });

  it("caps the benchmark share at 100 rather than exceeding the forest", () => {
    const cmp = compareToBaseline(100);
    expect(cmp.benchmarkPct).toBe(100);
    expect(cmp.shortfall).toBe(0);
    expect(cmp.meetsBaseline).toBe(true);
  });

  it("treats a score at the baseline as meeting it", () => {
    const cmp = compareToBaseline(BASELINE_SCORE);
    expect(cmp.meetsBaseline).toBe(true);
    expect(cmp.shortfall).toBe(0);
  });

  it("clamps out-of-range and non-numeric input", () => {
    expect(compareToBaseline(-20).score).toBe(0);
    expect(compareToBaseline(140).score).toBe(100);
    expect(compareToBaseline(Number.NaN).score).toBe(0);
  });
});

describe("baselineSentence", () => {
  it("says the site is at the benchmark when it meets it", () => {
    expect(baselineSentence(compareToBaseline(90))).toMatch(/at the benchmark/);
  });

  it("quotes the benchmark share for a depleted site", () => {
    const cmp = compareToBaseline(14);
    expect(baselineSentence(cmp)).toContain(`${cmp.benchmarkPct}%`);
  });

  it("never blames the site", () => {
    for (const score of [0, 14, 40, 60, 79, 100]) {
      const text = baselineSentence(compareToBaseline(score));
      expect(text).not.toMatch(/fail|bad|poor|worst/i);
    }
  });

  // The copy is shown on scans of Jakarta and Copenhagen too, where a claim
  // about "the absorption this ground had in 1609" is simply false -- and it
  // over-claims inside Manhattan as well, since 79.1 is one island-wide figure
  // for an island the project found to be anything but uniform.
  it("never claims to know the scanned site's own history", () => {
    for (const score of [0, 14, 40, 60, 79, 100]) {
      const text = baselineSentence(compareToBaseline(score));
      expect(text).not.toMatch(/it had in 1609/i);
      expect(text).not.toMatch(/used to|once (?:took|absorbed)|started with/i);
      expect(text).not.toMatch(/\bkeeps\b|\bretain/i);
    }
  });

  it("names the benchmark as the thing being compared against", () => {
    for (const score of [0, 14, 40, 60, 79, 100]) {
      expect(baselineSentence(compareToBaseline(score))).toMatch(
        /Mannahatta|benchmark/
      );
    }
  });
});
