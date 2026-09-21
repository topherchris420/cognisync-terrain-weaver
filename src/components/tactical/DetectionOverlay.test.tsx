import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DetectionOverlay } from "./DetectionOverlay";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";
import type { IoTSensor } from "@/lib/tactical/types";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";

describe("DetectionOverlay", () => {
  it("renders null or handles empty props without throwing errors", () => {
    const { container } = render(
      <SensorOpticsProvider>
        <DetectionOverlay sensors={[]} riskZones={[]} flowPaths={[]} />
      </SensorOpticsProvider>
    );
    expect(container).toBeDefined();
  });

  it("renders targets derived from TacticalPage simulation data without error", () => {
    const simFlows: FlowPath[] = [
      {
        points: [
          [-74.01, 40.715],
          [-74.008, 40.713],
        ],
        volume_m3: 680,
        velocity_mps: 2.1,
      },
    ];

    const simZones: RiskZone[] = [
      {
        polygon: [
          [-74.009, 40.71],
          [-74.003, 40.71],
          [-74.004, 40.707],
        ],
        level: "severe",
        affected_area_km2: 0.28,
      },
    ];

    const mockSensors: IoTSensor[] = [
      {
        id: "sensor-1",
        name: "Hudson River Gage",
        station_code: "USGS-01",
        type: "usgs_streamgage",
        coordinates: [-74.006, 40.7128],
        reading: 2.45,
        unit: "m",
        stage_height_m: 2.45,
        threshold_warning: 3.0,
        threshold_emergency: 4.5,
        status: "normal",
        battery_pct: 95,
        last_ping: new Date().toISOString(),
        historical_readings: [],
      },
    ];

    const { container } = render(
      <SensorOpticsProvider>
        <DetectionOverlay
          sensors={mockSensors}
          riskZones={simZones}
          flowPaths={simFlows}
        />
      </SensorOpticsProvider>
    );

    expect(container).toBeDefined();
  });
});
