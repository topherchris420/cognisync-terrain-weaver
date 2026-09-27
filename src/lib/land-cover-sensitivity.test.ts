import { describe, expect, it } from "vitest";
import { landCoverSensitivity } from "./land-cover-sensitivity";
const cover = { vegetation: 2, pavement: 48, water: 50, soil: 0, buildings: 0 };
describe("classification sensitivity", () => {
  it("caps transfers, preserves mass and leaves water unchanged", () => {
    const rows = landCoverSensitivity(cover, 1000, 50, 5);
    expect(rows.map(r => r.shiftPP)).toEqual([-2, 0, 5]);
    for (const row of rows) {
      expect(Object.values(row.cover).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
      expect(row.cover.water).toBe(50);
    }
    expect(rows[0].runoffM3).toBeGreaterThan(rows[1].runoffM3);
    expect(rows[2].runoffM3).toBeLessThan(rows[1].runoffM3);
  });
  it("uses physical land area and the shared retention weights", () => {
    const rows = landCoverSensitivity(cover, 1000, 50, 5);
    expect(rows[1].runoffM3 - rows[2].runoffM3).toBeCloseTo(1000 * .05 * .05 * (.8 - .12));
  });
  it("rejects invalid inputs rather than disguising them as zero runoff", () => {
    expect(() => landCoverSensitivity({ ...cover, pavement: NaN }, 1000, 50)).toThrow();
    expect(() => landCoverSensitivity(cover, -1, 50)).toThrow();
  });
});
