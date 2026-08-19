import { describe, it, expect } from "vitest";
import { generateAuditEntry, MUNICIPAL_OPERATIONAL_CONTROLS, DEFAULT_GOVCLOUD_POSTURE } from "./compliance";
import { generateTacticalAssets } from "./generator";

describe("Municipal EOC Posture & Audit Log", () => {
  it("generates deterministic checksummed audit log entries", () => {
    const entry = generateAuditEntry("EOC_DISPATCHER", "DISPATCH_SUPPLY", "CONVOY_ALPHA");
    expect(entry.id).toMatch(/^EOC-/);
    expect(entry.actor).toBe("EOC_DISPATCHER");
    expect(entry.action).toBe("DISPATCH_SUPPLY");
    expect(entry.classification).toBe("OFFICIAL USE // INCIDENT LOG");
    expect(entry.checksum).toMatch(/^SHA256:/);
  });

  it("contains standard Municipal EOC operational controls", () => {
    expect(MUNICIPAL_OPERATIONAL_CONTROLS.length).toBeGreaterThanOrEqual(4);
    const sec2 = MUNICIPAL_OPERATIONAL_CONTROLS.find((c) => c.id === "SEC-2");
    expect(sec2).toBeDefined();
    expect(sec2?.status).toBe("TLS 1.3 Active");
  });

  it("has default municipal enterprise GIS posture", () => {
    expect(DEFAULT_GOVCLOUD_POSTURE.environment).toBe("Municipal Enterprise GIS Node");
    expect(DEFAULT_GOVCLOUD_POSTURE.telemetry_integrity).toBeDefined();
  });
});

describe("Tactical Asset Generator", () => {
  it("georeferences IoT sensors, corridors, and supply nodes around map center", () => {
    const state = generateTacticalAssets(40.7128, -74.006, {
      north: 40.72,
      south: 40.70,
      east: -73.99,
      west: -74.02,
    });

    expect(state.sensors.length).toBeGreaterThanOrEqual(3);
    expect(state.corridors.length).toBeGreaterThanOrEqual(3);
    expect(state.supply_nodes.length).toBeGreaterThanOrEqual(3);
    expect(state.convoys.length).toBeGreaterThanOrEqual(2);
    expect(state.alerts.length).toBeGreaterThanOrEqual(2);

    // Verify coordinates are in reasonable delta from center
    state.sensors.forEach((s) => {
      expect(Math.abs(s.coordinates[1] - 40.7128)).toBeLessThan(0.05);
      expect(Math.abs(s.coordinates[0] - -74.006)).toBeLessThan(0.05);
    });
  });
});
