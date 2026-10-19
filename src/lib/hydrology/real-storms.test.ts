import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRealStormCache, detectStormEvents, fetchRealStorms } from "./real-storms";

function hourlySeries(spec: Array<[string, number]>): { times: string[]; rain: number[] } {
  return { times: spec.map(([t]) => t), rain: spec.map(([, r]) => r) };
}

beforeEach(() => clearRealStormCache());

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
    expect(events[0].totalDepthMm).toBe(15.1);
    expect(events[0].hyetograph.reduce((sum, h) => sum + h.rainMm, 0))
      .toBeCloseTo(events[0].totalDepthMm, 8);
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


describe("fetchRealStorms", () => {
  const payload = {
    hourly: {
      time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"],
      precipitation: [6, 0.2, 5],
    },
  };

  it("uses UTC hours and preserves total rainfall through the hyetograph", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true, json: async () => payload,
    })) as unknown as typeof fetch;
    const result = await fetchRealStorms(40.71, -74.01, fetchImpl);
    expect(result.status).toBe("observed");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].totalDepthMm).toBe(11.2);
    expect(result.events[0].hyetograph.reduce((s, p) => s + p.rainMm, 0)).toBeCloseTo(11.2);
    expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toContain("timezone=GMT");
  });

  it("rejects a partial archive rather than treating missing rainfall as zero", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ hourly: { ...payload.hourly, precipitation: [6, null, 5] } }),
    })) as unknown as typeof fetch;
    const result = await fetchRealStorms(40.71, -74.01, fetchImpl);
    expect(result.status).toBe("unavailable");
    expect(result.events).toEqual([]);
  });

  it("rejects gaps in the returned hourly timeline", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hourly: { time: ["2026-09-01T00:00", "2026-09-01T02:00"], precipitation: [8, 8] },
      }),
    })) as unknown as typeof fetch;
    expect((await fetchRealStorms(40.71, -74.01, fetchImpl)).status).toBe("unavailable");
  });

  it("allows a retry after an API outage instead of caching an error indefinitely", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true, json: async () => payload }) as unknown as typeof fetch;
    expect((await fetchRealStorms(40.71, -74.01, fetchImpl)).status).toBe("unavailable");
    expect((await fetchRealStorms(40.71, -74.01, fetchImpl)).status).toBe("observed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
