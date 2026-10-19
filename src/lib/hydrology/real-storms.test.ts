import { describe, expect, it } from "vitest";
import { detectStormEvents } from "./real-storms";

function hourlySeries(spec: Array<[string, number]>): { times: string[]; rain: number[] } {
  return { times: spec.map(([t]) => t), rain: spec.map(([, r]) => r) };
}

describe("detectStormEvents", () => {
  it("merges rainy hours across gaps of up to 3 hours into one event", () => {
    const { times, rain } = hourlySeries([
      ["2026-09-01T00:00", 5],
      ["2026-09-01T01:00", 4],
      ["2026-09-01T02:00", 0],
      ["2026-09-01T03:00", 0.1],
      ["2026-09-01T04:00", 0],
      ["2026-09-01T05:00", 6],
    ]);
    const events = detectStormEvents(times, rain);
    expect(events).toHaveLength(1);
    expect(events[0].totalDepthMm).toBeCloseTo(15.1, 1);
    expect(events[0].durationMinutes).toBe(6 * 60);
    expect(events[0].peakIntensityMmH).toBe(6);
  });

  it("splits events separated by more than 3 dry hours and ranks by depth", () => {
    const spec: Array<[string, number]> = [];
    for (let h = 0; h < 48; h += 1) {
      const day = h < 24 ? "01" : "02";
      spec.push([`2026-09-${day}T${String(h % 24).padStart(2, "0")}:00`, 0]);
    }
    spec[2][1] = 8; // small event: 8+4 = 12 mm
    spec[3][1] = 4;
    spec[30][1] = 20; // big event: 20+15 = 35 mm
    spec[31][1] = 15;
    const { times, rain } = hourlySeries(spec);
    const events = detectStormEvents(times, rain);
    expect(events).toHaveLength(2);
    expect(events[0].totalDepthMm).toBe(35);
    expect(events[1].totalDepthMm).toBe(12);
  });

  it("drops events under 10 mm total", () => {
    const { times, rain } = hourlySeries([
      ["2026-09-01T00:00", 3],
      ["2026-09-01T01:00", 2],
    ]);
    expect(detectStormEvents(times, rain)).toHaveLength(0);
  });

  it("gives each event a stable hyetograph identity hash", () => {
    const { times, rain } = hourlySeries([
      ["2026-09-01T00:00", 10],
      ["2026-09-01T01:00", 5],
    ]);
    const a = detectStormEvents(times, rain);
    const b = detectStormEvents(times, rain);
    expect(a[0].hyetographHash).toBe(b[0].hyetographHash);
    expect(a[0].id).toBe(`storm:${a[0].hyetographHash}`);
    expect(a[0].hyetograph).toEqual([
      { tMin: 0, rainMm: 10 },
      { tMin: 60, rainMm: 5 },
    ]);
  });
});
