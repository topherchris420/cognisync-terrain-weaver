import { describe, expect, it, vi } from "vitest";
import {
  OPTIC_MODES,
  latLngToMaidenhead,
  playTacticalSound,
  SensorOpticMode,
} from "./sensor-optics";

describe("sensor-optics engine", () => {
  it("defines configs for all 6 visual optic modes", () => {
    const modes: SensorOpticMode[] = ["NORMAL", "NVG", "FLIR", "CRT", "NOIR", "IR"];
    modes.forEach((mode) => {
      const config = OPTIC_MODES[mode];
      expect(config).toBeDefined();
      expect(config.id).toBe(mode);
      expect(config.shortcut).toBeDefined();
      expect(config.cssFilter).toBeDefined();
      expect(config.accentColor).toBeDefined();
    });
  });

  it("converts latitude and longitude to Maidenhead Grid locator", () => {
    // New York / Manhattan ~ [40.758, -73.985] -> FN30as
    const grid1 = latLngToMaidenhead(40.758, -73.985);
    expect(grid1).toBe("FN30as");

    // Copenhagen ~ [55.676, 12.568] -> JO65fr
    const grid2 = latLngToMaidenhead(55.676, 12.568);
    expect(grid2.length).toBe(6);
    expect(grid2.substring(0, 2)).toBe("JO");
  });

  it("plays tactical sound effects without throwing when audio is uninitialized", () => {
    expect(() => playTacticalSound("click")).not.toThrow();
    expect(() => playTacticalSound("switch")).not.toThrow();
    expect(() => playTacticalSound("lock")).not.toThrow();
    expect(() => playTacticalSound("alert")).not.toThrow();
    expect(() => playTacticalSound("hum")).not.toThrow();
  });
});
