import { describe, expect, it } from "vitest";
import { EXAMPLE_ANALYSIS } from "./example-analysis";
import { classifyFloodRisk, computeAbsorptionScore } from "./absorption";
import { analysesToCSV, analysesToGeoJSON, parseBBox } from "./geo";

describe("illustrative example analysis", () => {
  it("has a complete land-cover distribution and derived metrics", () => {
    expect(Object.values(EXAMPLE_ANALYSIS.land_cover).reduce((a, b) => a + b, 0)).toBe(100);
    expect(EXAMPLE_ANALYSIS.absorption_score).toBe(computeAbsorptionScore(EXAMPLE_ANALYSIS.land_cover));
    expect(EXAMPLE_ANALYSIS.flood_risk).toBe(classifyFloodRisk(EXAMPLE_ANALYSIS.absorption_score));
  });
  it("labels exported data as an example and locates it inside its footprint", () => {
    expect(EXAMPLE_ANALYSIS.name).toMatch(/example/i);
    expect(EXAMPLE_ANALYSIS.status).toBe("example");
    expect(EXAMPLE_ANALYSIS.ai_notes).toMatch(/illustrative/i);
    const bounds = parseBBox(EXAMPLE_ANALYSIS.bbox)!;
    expect(EXAMPLE_ANALYSIS.center_lng).toBeGreaterThan(bounds[0][0]);
    expect(EXAMPLE_ANALYSIS.center_lng).toBeLessThan(bounds[1][0]);
    expect(EXAMPLE_ANALYSIS.center_lat).toBeGreaterThan(bounds[0][1]);
    expect(EXAMPLE_ANALYSIS.center_lat).toBeLessThan(bounds[1][1]);
  });
  it("preserves the illustrative label in both GIS export formats", () => {
    expect(analysesToCSV([EXAMPLE_ANALYSIS])).toMatch(/illustrative example/);
    expect(analysesToGeoJSON([EXAMPLE_ANALYSIS]).features[0].properties.name).toMatch(/illustrative example/);
  });
});
