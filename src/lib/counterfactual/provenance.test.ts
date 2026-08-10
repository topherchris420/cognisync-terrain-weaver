import { describe, expect, it } from "vitest";
import {
  assertCompleteProvenance,
  combineProvenance,
} from "./provenance";
import type { DataProvenance } from "./types";

const record = (partial: Partial<DataProvenance> = {}): DataProvenance => ({
  sourceId: "nyc-landcover-2026",
  title: "NYC land cover",
  agency: "NYC",
  url: "https://example.com/land-cover",
  accessedAt: "2026-08-10",
  confidence: "high",
  status: "observed",
  caveats: [],
  ...partial,
});

describe("assertCompleteProvenance", () => {
  it("fails closed when required lineage is absent", () => {
    expect(() =>
      assertCompleteProvenance([
        record({
          sourceId: "",
          url: "",
        }),
      ])
    ).toThrow(/sourceId|url/);
  });
});

describe("combineProvenance", () => {
  it("deduplicates repeated lineage entries while preserving first-seen order", () => {
    const first = record({ sourceId: "first" });
    const duplicate = record({ sourceId: "first" });
    const second = record({ sourceId: "second", url: "https://example.com/two" });

    expect(combineProvenance([first, duplicate, second])).toEqual([first, second]);
  });
});
