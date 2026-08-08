import { describe, expect, it } from "vitest";
import { BASELINE_SCORE } from "@/lib/baseline";
import { buildCatalystSiteContext } from "./context";
import type { AnalysisRecord } from "@/lib/types";

const analysis: AnalysisRecord = {
  id: "scan-1",
  name: "Midtown block",
  location_label: "Times Square, New York",
  center_lat: 40.758,
  center_lng: -73.985,
  zoom: 15,
  bbox: [
    [-73.99, 40.755],
    [-73.98, 40.762],
  ],
  image_data_url: null,
  land_cover: {
    vegetation: 2,
    soil: 1,
    water: 0,
    buildings: 54,
    pavement: 43,
  },
  absorption_score: 14,
  flood_risk: "high",
  recommendations: [],
  ai_notes: null,
  status: "complete",
  created_at: "2026-08-07T12:00:00.000Z",
};

describe("buildCatalystSiteContext", () => {
  it("maps active analysis state without inventing missing numbers", () => {
    const context = buildCatalystSiteContext(analysis, {
      rainfallMm: 100,
      simulationResult: {
        flow_paths: [],
        risk_zones: [],
        impact_points: [],
        metadata: {
          processed_area_km2: 0.8,
          cells_analyzed: 8100,
          computation_time_ms: 42,
        },
      },
    });

    expect(context.analysisId).toBe("scan-1");
    expect(context.location?.bbox).toEqual([-73.99, 40.755, -73.98, 40.762]);
    expect(context.present.landCover).toEqual({
      vegetation: 2,
      bareSoil: 1,
      buildings: 54,
      pavement: 43,
      water: 0,
    });
    expect(context.present.floodRisk).toBe("high");
    expect(context.historical1609.absorptionScore).toBe(BASELINE_SCORE);
    expect(context.historical1609.deltaFromPresent).toBeCloseTo(
      BASELINE_SCORE - 14,
      1
    );
    expect(context.historical1609.provenance).toBe("estimated");
    expect(context.rainfall?.depthMm).toBe(100);
    expect(context.hydrology?.riskSummary).toMatch(/0 risk zones/i);
  });

  it("omits optional context when source values are unavailable", () => {
    const context = buildCatalystSiteContext({ ...analysis, bbox: null }, {});

    expect(context.location?.bbox).toBeUndefined();
    expect(context.activeScenario).toBeUndefined();
    expect(context.rainfall).toBeUndefined();
    expect(context.hydrology).toBeUndefined();
  });
});
