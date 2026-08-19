import { describe, it, expect } from "vitest";
import { generateAuditEntry, FEDRAMP_HIGH_CONTROLS, DEFAULT_GOVCLOUD_POSTURE } from "./compliance";
import { generateTacticalAssets } from "./generator";

describe("FedRAMP GovCloud Compliance & Audit Log", () => {
  it("generates deterministic checksummed audit log entries", () => {
    const entry = generateAuditEntry("EOC_DISPATCHER", "DISPATCH_SUPPLY", "CONVOY_ALPHA");
    expect(entry.id).toMatch(/^AUDIT-/);
    expect(entry.actor).toBe("EOC_DISPATCHER");
    expect(entry.action).toBe("DISPATCH_SUPPLY");
    expect(entry.classification).toBe("CUI // SP-EMERGENCY");
    expect(entry.checksum).toMatch(/^SHA256:/);
  });

  it("contains standard FedRAMP High NIST 800-53 controls", () => {
    expect(FEDRAMP_HIGH_CONTROLS.length).toBeGreaterThanOrEqual(4);
    const sc13 = FEDRAMP_HIGH_CONTROLS.find((c) => c.id === "SC-13");
    expect(sc13).toBeDefined();
    expect(sc13?.status).toBe("Enforced (HSM)");
  });

  it("has default GovCloud FIPS 140 Level 3 posture", () => {
    expect(DEFAULT_GOVCLOUD_POSTURE.fips_140_level).toBe(3);
    expect(DEFAULT_GOVCLOUD_POSTURE.us_person_sovereignty).toBe(true);
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
