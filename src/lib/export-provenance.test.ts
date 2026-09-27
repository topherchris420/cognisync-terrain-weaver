import { expect, it } from "vitest";
import { EXAMPLE_ANALYSIS } from "./example-analysis";
import { analysesToCSV, analysesToGeoJSON } from "./geo";
it("preserves fixture identity even when the user renames the example", () => {
  const renamed = { ...EXAMPLE_ANALYSIS, name: "My study", ai_notes: null };
  expect(analysesToGeoJSON([renamed]).features[0].properties.provenance).toBe("illustrative");
  expect(analysesToCSV([renamed])).toContain("example,illustrative");
});
