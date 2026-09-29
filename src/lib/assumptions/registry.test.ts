import { describe, expect, it } from "vitest";
import { ABSORPTION_WEIGHTS, RISK_BANDS } from "@/lib/absorption";
import { DEFAULT_ASSUMPTIONS, INTERVENTIONS, INTERVENTION_ORDER } from "@/lib/scenario";
import { RUNOFF_COEFFICIENT } from "@/lib/simulation";
import { ASSUMPTIONS, assumption } from "./registry";

describe("assumption registry mirrors every live constant", () => {
  it("retention weights", () => {
    for (const [key, weight] of Object.entries(ABSORPTION_WEIGHTS)) {
      expect(assumption(`retention.${key}`).value).toBe(weight);
    }
  });

  it("routing runoff coefficients are the complements of the registered retention weights", () => {
    for (const [key, weight] of Object.entries(ABSORPTION_WEIGHTS)) {
      expect(RUNOFF_COEFFICIENT[key as keyof typeof ABSORPTION_WEIGHTS]).toBeCloseTo(1 - weight, 12);
    }
    expect(RUNOFF_COEFFICIENT.water).toBe(1 - assumption("retention.water").value);
  });

  it("intervention retention and unit costs", () => {
    for (const key of INTERVENTION_ORDER) {
      expect(assumption(`intervention.${key}.retention`).value).toBe(INTERVENTIONS[key].targetWeight);
      expect(assumption(`cost.${key}`).value).toBe(INTERVENTIONS[key].unitCostUSD);
    }
  });

  it("economics defaults and score bands", () => {
    expect(assumption("economics.annual_rainfall").value).toBe(DEFAULT_ASSUMPTIONS.annualRainfallMm);
    expect(assumption("economics.benefit_per_m3").value).toBe(DEFAULT_ASSUMPTIONS.benefitPerM3USD);
    expect(assumption("score.band.moderate").value).toBe(RISK_BANDS.moderate);
    expect(assumption("score.band.low").value).toBe(RISK_BANDS.low);
  });
});

describe("assumption registry is honest about provenance", () => {
  it("never leaves provenance blank: unsourced values are declared scenario assumptions", () => {
    for (const a of ASSUMPTIONS) {
      if (a.source === null) expect(a.basis, a.id).toBe("scenario-assumption");
      if (a.basis === "published-range") expect(a.range, a.id).not.toBeNull();
      expect(a.tripwire.condition.length, a.id).toBeGreaterThan(20);
      expect(a.tripwire.basis.length, a.id).toBeGreaterThan(10);
    }
  });

  it("keeps each sourced value inside its own published range", () => {
    for (const a of ASSUMPTIONS.filter((x) => x.range)) {
      expect(a.value, a.id).toBeGreaterThanOrEqual(a.range![0]);
      expect(a.value, a.id).toBeLessThanOrEqual(a.range![1]);
    }
  });

  it("has unique ids", () => {
    expect(new Set(ASSUMPTIONS.map((a) => a.id)).size).toBe(ASSUMPTIONS.length);
  });
});
