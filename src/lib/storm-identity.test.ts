import { describe, it, expect } from "vitest";
import {
  createStormSeal,
  verifyStormSeal,
  checkStormDeterminism,
  formatSealedAt,
} from "./storm-identity";
import { buildStormDefinition } from "@/pages/Analyze";

const storm = () => buildStormDefinition(50, "low");

describe("storm seal", () => {
  it("derives the same seed for the same storm regardless of when it is sealed", () => {
    const a = createStormSeal(storm(), "2026-08-11T00:00:00.000Z");
    const b = createStormSeal(storm(), "2026-08-12T09:30:00.000Z");
    expect(a.seed).toBe(b.seed);
    expect(a.sealedAt).not.toBe(b.sealedAt);
  });

  it("changes the seed when the storm physically differs", () => {
    expect(createStormSeal(buildStormDefinition(50, "low")).seed).not.toBe(
      createStormSeal(buildStormDefinition(80, "low")).seed
    );
  });

  it("verifies integrity and detects tampering", () => {
    const seal = createStormSeal(storm());
    expect(verifyStormSeal(seal)).toBe(true);
    expect(
      verifyStormSeal({
        ...seal,
        storm: { ...seal.storm, rainfallDepthMm: 90 },
      })
    ).toBe(false);
  });
});

describe("checkStormDeterminism", () => {
  it("passes when NOW and POSSIBLE share one storm", () => {
    const report = checkStormDeterminism(
      createStormSeal(storm(), "2026-08-11T00:00:00.000Z"),
      createStormSeal(storm(), "2026-08-11T00:04:00.000Z")
    );
    expect(report.identical).toBe(true);
    expect(report.mismatches).toEqual([]);
  });

  it("fails and names every differing parameter", () => {
    const report = checkStormDeterminism(
      createStormSeal(buildStormDefinition(50, "low")),
      createStormSeal(buildStormDefinition(80, "high"))
    );
    expect(report.identical).toBe(false);
    expect(report.mismatches).toContain("Rainfall depth (mm)");
    expect(report.mismatches).toContain("Grid resolution");
    expect(report.mismatches).toContain("Storm seed");
  });

  it("fails a tampered seal", () => {
    const now = createStormSeal(storm());
    const tampered = { ...now, seed: "0000000000000000" };
    const report = checkStormDeterminism(now, tampered);
    expect(report.identical).toBe(false);
    expect(report.mismatches).toContain("Seal integrity");
  });
});

describe("formatSealedAt", () => {
  it("renders a UTC timestamp", () => {
    expect(formatSealedAt("2026-08-11T21:06:09.000Z")).toBe("2026-08-11 21:06:09Z");
  });
});
