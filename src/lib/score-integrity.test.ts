import { describe, expect, it } from "vitest";
import { withCurrentScore } from "./score-integrity";

describe("scores are recomputed from land cover, never trusted from storage", () => {
  const bois = { vegetation: 85, soil: 1, water: 7, buildings: 2, pavement: 5 };

  it("replaces a stale stored score and keeps the stored value visible", () => {
    // A live row stored 89.7 under the pre-recalibration weights (classification/C3).
    const rescored = withCurrentScore({ id: "x", land_cover: bois, absorption_score: 89.7, flood_risk: "low" });
    expect(rescored.absorption_score).toBe(74.7);
    expect(rescored.flood_risk).toBe("low");
    expect(rescored.stored_absorption_score).toBe(89.7);
  });

  it("marks nothing when storage agrees with the scorer", () => {
    const rescored = withCurrentScore({ land_cover: bois, absorption_score: 74.7 });
    expect(rescored.stored_absorption_score).toBeUndefined();
  });

  it("changes the band when the recomputed score crosses a threshold", () => {
    const midtown = { vegetation: 3, soil: 2, water: 0, buildings: 60, pavement: 35 };
    expect(withCurrentScore({ land_cover: midtown, absorption_score: 9.5 }).absorption_score).toBe(14);
    const tiergarten = { vegetation: 55, soil: 1, water: 3, buildings: 15.5, pavement: 25.5 };
    expect(withCurrentScore({ land_cover: tiergarten, absorption_score: 59.4, flood_risk: "low" }).flood_risk).toBe("moderate");
  });

  it("falls back to the stored score only when land cover is unusable", () => {
    const rescored = withCurrentScore({ land_cover: null, absorption_score: 40 });
    expect(rescored.absorption_score).toBe(40);
    expect(rescored.stored_absorption_score).toBeUndefined();
  });
});
