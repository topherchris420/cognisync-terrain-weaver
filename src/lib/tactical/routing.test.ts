import { describe, it, expect } from "vitest";
import {
  geoDistanceMeters,
  pointInPolygon,
  evaluateCorridorHazard,
} from "./routing";
import type { TransitCorridor } from "./types";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";

describe("Tactical Routing & Hazard Cross-Referencing", () => {
  it("calculates accurate geographic distances between coordinates", () => {
    // Approx 111km per latitude degree
    const d = geoDistanceMeters([-74.0, 40.7], [-74.0, 40.71]);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1130);
  });

  it("accurately tests point-in-polygon containment", () => {
    const polygon: [number, number][] = [
      [-74.01, 40.7],
      [-74.01, 40.72],
      [-73.99, 40.72],
      [-73.99, 40.7],
    ];

    expect(pointInPolygon([-74.0, 40.71], polygon)).toBe(true);
    expect(pointInPolygon([-74.05, 40.71], polygon)).toBe(false);
  });

  it("flags transit corridor as closed when intersecting high-volume D8 flow paths", () => {
    const corridor: TransitCorridor = {
      id: "test-corridor",
      name: "Main Evacuation Way",
      designation: "Evac-1",
      status: "clear",
      capacity_pct: 50,
      coordinates: [
        [-74.005, 40.712],
        [-74.004, 40.713],
      ],
      inundation_risk_score: 0,
      intersecting_flow_volume_m3: 0,
    };

    const flowPaths: FlowPath[] = [
      {
        points: [
          [-74.005, 40.712],
          [-74.0045, 40.7125],
        ],
        volume_m3: 950,
        velocity_mps: 2.5,
      },
    ];

    const result = evaluateCorridorHazard(corridor, flowPaths, []);
    expect(result.status).toBe("closed");
    expect(result.inundation_risk_score).toBeGreaterThanOrEqual(75);
    expect(result.intersecting_flow_volume_m3).toBe(950);
  });

  it("flags corridor inside severe risk zone as flooded or closed", () => {
    const corridor: TransitCorridor = {
      id: "lowland-street",
      name: "Lowland Street",
      designation: "Sec-2",
      status: "clear",
      capacity_pct: 30,
      coordinates: [[-74.0, 40.71]],
      inundation_risk_score: 0,
      intersecting_flow_volume_m3: 0,
    };

    const riskZones: RiskZone[] = [
      {
        polygon: [
          [-74.01, 40.7],
          [-74.01, 40.72],
          [-73.99, 40.72],
          [-73.99, 40.7],
        ],
        level: "severe",
        affected_area_km2: 0.5,
      },
    ];

    const result = evaluateCorridorHazard(corridor, [], riskZones);
    expect(result.inundation_risk_score).toBeGreaterThanOrEqual(80);
    expect(["flooded", "closed"]).toContain(result.status);
  });
});
