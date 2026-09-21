import { describe, expect, it } from "vitest";
import { LocalCatalystProvider } from "./localCompiler";
import type { CatalystRequest, CatalystSiteContext } from "./types";

const context: CatalystSiteContext = {
  analysisId: "scan-1",
  location: {
    name: "Times Square, New York",
    latitude: 40.758,
    longitude: -73.985,
    zoom: 15,
    bbox: [-73.99, 40.755, -73.98, 40.762],
  },
  present: {
    absorptionScore: 12,
    landCover: {
      vegetation: 0,
      bareSoil: 0,
      buildings: 0,
      pavement: 100,
    },
    floodRisk: "high",
  },
  historical1609: {
    absorptionScore: 79.1,
    deltaFromPresent: 67.1,
    provenance: "estimated",
  },
};

describe("LocalCatalystProvider", () => {
  it("compiles deterministic minimum-intervention experiments from existing scenario math", async () => {
    const provider = new LocalCatalystProvider();
    const request: CatalystRequest = {
      kind: "minimum-intervention",
      targetScore: 40,
      intervention: "tree_canopy",
    };

    const first = await provider.compileExperiment(context, request);
    const second = await provider.compileExperiment(context, request);

    expect(first).toEqual(second);
    expect(first.executionStatus).toBe("executable");
    expect(first.actions).toHaveLength(1);
    expect(first.actions[0]).toMatchObject({
      type: "scenario",
      intervention: "tree_canopy",
    });
    if (first.actions[0].type === "scenario") {
      expect(first.actions[0].fraction).toBeCloseTo(0.4118, 3);
    }
    expect(first.verification?.score).toBeGreaterThanOrEqual(40);
  });

  it("reports impossible targets without pretending unsupported work ran", async () => {
    const provider = new LocalCatalystProvider();

    const experiment = await provider.compileExperiment(context, {
      kind: "minimum-intervention",
      targetScore: 95,
      intervention: "tree_canopy",
    });

    expect(experiment.executionStatus).toBe("partially-executable");
    expect(experiment.verification?.warnings.join(" ")).toMatch(/cannot reach/i);
    expect(experiment.actions.some((action) => action.type === "custom")).toBe(true);
  });

  it("keeps scientific result language out of proven/proof territory", async () => {
    const provider = new LocalCatalystProvider();

    const experiment = await provider.compileExperiment(context, {
      kind: "compare-interventions",
      fraction: 0.25,
    });

    const serialized = JSON.stringify(experiment).toLowerCase();
    expect(serialized).not.toContain("proven");
    expect(serialized).not.toContain("proof");
    expect(serialized).toContain("supported under this simulation");
  });
});
