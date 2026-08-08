import { beforeEach, describe, expect, it } from "vitest";
import {
  createCounterfactualId,
  loadFieldNotes,
  saveFieldNote,
} from "./fieldNotes";
import type { CatalystFieldNote } from "./types";

describe("field notes persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates human-readable counterfactual IDs", () => {
    expect(createCounterfactualId(42)).toBe("MNH-CF-0042");
    expect(createCounterfactualId(10001)).toBe("MNH-CF-10001");
  });

  it("stores and restores scientific field notes locally", () => {
    const note: CatalystFieldNote = {
      id: "MNH-CF-0042",
      timestamp: "2026-08-07T12:00:00.000Z",
      hypothesis: "Convert pavement.",
      terrainContext: {
        presentScore: 14,
        historicalScore: 79.1,
        provenance: "estimated",
      },
      intervention: "tree_canopy 25%",
      outcome: "SUPPORTED UNDER THIS SIMULATION",
      assumptions: ["Scenario math only."],
      limitations: ["No field validation."],
    };

    saveFieldNote(note);

    expect(loadFieldNotes()).toEqual([note]);
  });
});
