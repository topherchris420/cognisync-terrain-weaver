import { expect, it } from "vitest";
import { validateLandCover } from "../../supabase/functions/_shared/land-cover";
it("rejects incomplete, nonnumeric, negative and unbalanced classifier proposals", () => {
  const cover = { vegetation: 10, pavement: 50, buildings: 30, soil: 5, water: 5 };
  expect(validateLandCover(cover)).toEqual(cover);
  for (const invalid of [{}, { ...cover, water: undefined }, { ...cover, water: "5" }, { ...cover, vegetation: -10 }, { ...cover, soil: Infinity }, { ...cover, pavement: 99 }]) expect(() => validateLandCover(invalid)).toThrow();
});
