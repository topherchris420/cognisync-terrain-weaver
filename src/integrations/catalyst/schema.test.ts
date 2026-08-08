import { describe, expect, it } from "vitest";
import {
  catalystActionSchema,
  catalystExperimentSchema,
  parseCatalystExperiment,
} from "./schema";

describe("Catalyst schemas", () => {
  it("accepts executable scenario and hydrology actions within bounds", () => {
    expect(
      catalystActionSchema.parse({
        type: "scenario",
        intervention: "permeable_pavement",
        fraction: 0.35,
      })
    ).toMatchObject({ type: "scenario", fraction: 0.35 });

    expect(
      catalystActionSchema.parse({
        type: "hydrology",
        rainfallMm: 100,
        resolution: "medium",
      })
    ).toMatchObject({ type: "hydrology", rainfallMm: 100 });
  });

  it("rejects malformed action ranges and invalid geometry", () => {
    expect(() =>
      catalystActionSchema.parse({
        type: "scenario",
        intervention: "tree_canopy",
        fraction: 1.2,
      })
    ).toThrow();

    expect(() =>
      catalystActionSchema.parse({
        type: "hydrology",
        rainfallMm: 0,
      })
    ).toThrow();

    expect(() =>
      catalystActionSchema.parse({
        type: "scenario",
        intervention: "tree_canopy",
        fraction: 0.2,
        geometry: { type: "Script", coordinates: [] },
      })
    ).toThrow();
  });

  it("rejects unsupported scientific status labels from remote responses", () => {
    expect(() =>
      catalystExperimentSchema.parse({
        id: "MNH-CF-0001",
        hypothesis: "A test",
        objective: "Test something",
        scientificStatus: "proven",
        assumptions: [],
        claims: [],
        variables: [],
        methodology: [],
        successCriteria: [],
        falsificationCriteria: [],
        limitations: [],
        requiredData: [],
        actions: [],
        executionStatus: "draft",
      })
    ).toThrow();
  });

  it("validates complete external experiments before state accepts them", () => {
    const experiment = parseCatalystExperiment({
      id: "MNH-CF-0042",
      hypothesis: "Converting pavement should improve modeled absorption.",
      objective: "Reach absorption score 40.",
      scientificStatus: "experimental",
      assumptions: ["Current land-cover classification is accepted as input."],
      claims: [
        {
          id: "claim-1",
          statement: "Scenario math is deterministic.",
          status: "established",
        },
      ],
      variables: [
        { name: "converted pavement fraction", role: "independent", unit: "fraction" },
        { name: "absorption score", role: "dependent", unit: "score" },
      ],
      methodology: ["Run Mannahatta Scenario Studio scoring."],
      successCriteria: ["Projected score is at least 40."],
      falsificationCriteria: ["Projected score remains below 40."],
      limitations: ["Planning-level land-cover model only."],
      requiredData: ["Land-cover percentages."],
      actions: [
        {
          type: "scenario",
          intervention: "permeable_pavement",
          fraction: 0.5,
        },
      ],
      executionStatus: "executable",
      verification: { score: 41.2, warnings: [] },
    });

    expect(experiment.id).toBe("MNH-CF-0042");
  });
});
