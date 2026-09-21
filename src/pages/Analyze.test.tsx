import { describe, expect, it } from "vitest";
import {
  buildRealitySimulationRequest,
  buildStormDefinition,
} from "./Analyze";
import { buildRealitySurface } from "@/lib/counterfactual/modifiers";

const bbox = {
  north: 40.71,
  south: 40.7,
  east: -74,
  west: -74.01,
};

const provenance = [{
  sourceId: "test",
  title: "Test",
  agency: "Test",
  url: "https://example.test/source",
  accessedAt: "2026-08-10",
  confidence: "high" as const,
  status: "observed" as const,
  caveats: [],
}];

describe("Analyze counterfactual request orchestration", () => {
  it("builds NOW and POSSIBLE requests under one immutable storm", () => {
    const storm = buildStormDefinition(50, "low");
    const now = buildRealitySurface({
      id: "now",
      baselineLayerHash: "baseline:fixed",
      bbox,
      rows: 30,
      cols: 30,
      features: [],
      provenance,
      warnings: [],
    });
    const possible = {
      ...now,
      id: "possible" as const,
      interventionHash: "intervention:edited",
      surfaceHash: "surface:edited",
    };

    const nowRequest = buildRealitySimulationRequest(bbox, storm, now);
    const possibleRequest = buildRealitySimulationRequest(
      bbox,
      storm,
      possible,
      "fnv1a64:1111111111111111"
    );

    expect(nowRequest.storm).toBe(storm);
    expect(possibleRequest.storm).toBe(storm);
    expect(nowRequest.surface.id).toBe("now");
    expect(possibleRequest.surface.id).toBe("possible");
    expect(possibleRequest.expectedElevationHash).toBe(
      "fnv1a64:1111111111111111"
    );
    expect(nowRequest.surface.surfaceHash).not.toBe(
      possibleRequest.surface.surfaceHash
    );
  });

  it("never enables unsupported drainage", () => {
    expect(buildStormDefinition(50, "medium").includeDrainage).toBe(false);
  });
});
