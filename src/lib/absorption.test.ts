import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ABSORPTION_WEIGHTS,
  RISK_BANDS,
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
  it("scores all-vegetation land at its runoff coefficient, not at 100", () => {
    // No surface absorbs every drop that falls on it. Woodland on sandy soil
    // still sheds 5-25% (Rational Method C). A model that says 100 is wrong.
    expect(computeAbsorptionScore(cover({ vegetation: 100 }))).toBe(80);
  });

  it("scores fully paved land near zero", () => {
    expect(computeAbsorptionScore(cover({ pavement: 100 }))).toBe(12);
  });

  it("scores an all-roof tile near zero", () => {
    expect(computeAbsorptionScore(cover({ buildings: 100 }))).toBe(10);
  });

  it("returns 0 for an empty cover rather than dividing by zero", () => {
    expect(computeAbsorptionScore(cover({}))).toBe(0);
  });

  describe("open water is not absorption capacity", () => {
    it("gives a harbour no credit -- water is where runoff GOES", () => {
      // Half harbour, half pavement. The pavement is what has to absorb the
      // rain, and pavement absorbs almost nothing. The harbour must not rescue
      // the score, so this must equal the all-pavement case exactly.
      expect(computeAbsorptionScore(cover({ water: 50, pavement: 50 }))).toBe(12);
    });

    it("no longer flatters flood-exposed waterfront", () => {
      // The defect the calibration found. Under the old model the Port of
      // Rotterdam scored 45.8 ("moderate") against Kreuzberg's 36.5 ("high") --
      // a container terminal rated more flood-resilient than a leafy Berlin
      // residential district, purely because 45% of its frame was harbour.
      const rotterdam = cover({
        vegetation: 10.5, soil: 13, water: 45.5, buildings: 10.5, pavement: 20.5,
      });
      expect(computeAbsorptionScore(rotterdam)).toBeLessThan(45.8);
    });

    it("scores an all-water tile as zero, not as half-absorbent", () => {
      expect(computeAbsorptionScore(cover({ water: 100 }))).toBe(0);
    });
  });

  it("scores a real dense core low (Midtown Manhattan)", () => {
    const midtown = cover({
      vegetation: 3, soil: 2, water: 0, buildings: 60, pavement: 35,
    });
    const score = computeAbsorptionScore(midtown);
    expect(score).toBeCloseTo(14, 0);
    expect(classifyFloodRisk(score)).toBe("high");
  });

  it("scores real parkland high (Bois de Boulogne)", () => {
    const bois = cover({
      vegetation: 85, soil: 1, water: 7, buildings: 2, pavement: 5,
    });
    const score = computeAbsorptionScore(bois);
    expect(score).toBeCloseTo(74.7, 0);
    expect(classifyFloodRisk(score)).toBe("low");
  });
});

describe("classifyFloodRisk", () => {
  it("bands on the calibrated thresholds", () => {
    expect(classifyFloodRisk(RISK_BANDS.low)).toBe("low");
    expect(classifyFloodRisk(RISK_BANDS.low - 0.1)).toBe("moderate");
    expect(classifyFloodRisk(RISK_BANDS.moderate)).toBe("moderate");
    expect(classifyFloodRisk(RISK_BANDS.moderate - 0.1)).toBe("high");
    expect(classifyFloodRisk(0)).toBe("high");
  });
});

describe("riskColor / riskLabel", () => {
  it("maps each band to a semantic token", () => {
    expect(riskColor("low")).toBe("text-primary");
    expect(riskColor("moderate")).toBe("text-warning");
    expect(riskColor("high")).toBe("text-destructive");
  });

  it("capitalises the band name", () => {
    expect(riskLabel("moderate")).toBe("Moderate");
  });
});

// ---------------------------------------------------------------------------
// The scoring model exists in THREE places: here, the Deno edge function (which
// cannot import from src/), and the reference Python backend. They will drift --
// and the edge function is the one that actually computes and stores every
// score, so a drift means the site publishes one methodology and applies
// another. These tests read the other two implementations and fail on
// disagreement.
describe("all three copies of the scoring model agree", () => {
  const repoRoot = resolve(__dirname, "../..");

  it("the analyze-terrain edge function matches", () => {
    const src = readFileSync(
      resolve(repoRoot, "supabase/functions/analyze-terrain/index.ts"),
      "utf8"
    );

    for (const [key, weight] of Object.entries(ABSORPTION_WEIGHTS)) {
      expect(src, `edge function must weight ${key} at ${weight}`).toMatch(
        new RegExp(`${key}:\\s*${weight}\\b`)
      );
    }

    const weightsBlock = src.match(/const WEIGHTS[\s\S]*?\};/)?.[0] ?? "";
    expect(
      weightsBlock,
      "edge function must not weight water -- it is not absorption capacity"
    ).not.toMatch(/water/);

    expect(src).toMatch(new RegExp(`moderate:\\s*${RISK_BANDS.moderate}\\b`));
    expect(src).toMatch(new RegExp(`low:\\s*${RISK_BANDS.low}\\b`));
  });

  it("the python reference backend matches", () => {
    const src = readFileSync(
      resolve(repoRoot, "backend/app/services/scoring.py"),
      "utf8"
    );

    for (const [key, weight] of Object.entries(ABSORPTION_WEIGHTS)) {
      expect(src, `scoring.py must weight ${key} at ${weight}`).toMatch(
        new RegExp(`"${key}":\\s*${weight.toFixed(2)}`)
      );
    }

    const weightsBlock = src.match(/WEIGHTS: dict\[str, float\] = \{[\s\S]*?\}/)?.[0] ?? "";
    expect(weightsBlock, "scoring.py must not weight water").not.toMatch(/water/);

    expect(src).toMatch(new RegExp(`"moderate":\\s*${RISK_BANDS.moderate}`));
    expect(src).toMatch(new RegExp(`"low":\\s*${RISK_BANDS.low}`));
  });
});
