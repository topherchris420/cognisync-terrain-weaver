import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMap } from "@/test/fake-map";
import { ERAS, getEra, type MapEra } from "@/lib/historical/eras";
import {
  FIRST_TILE_TIMEOUT_MS,
  MAX_TILE_FAILURES,
  type ImageryStatus,
  type ProbeResult,
} from "@/lib/historical/era-imagery";
import { EraRasterLayer } from "./EraRasterLayer";

// Each era's probe is controlled by the test: resolve it now, later, or never.
const probes = vi.hoisted(() => ({
  pending: new Map<string, (result: ProbeResult) => void>(),
  auto: true as boolean,
  verdict: new Map<string, ProbeResult>(),
}));

vi.mock("@/lib/historical/era-imagery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/historical/era-imagery")>();
  return {
    ...actual,
    probeEraImageryCached: (era: MapEra) =>
      probes.auto
        ? Promise.resolve(probes.verdict.get(era.id) ?? { ok: true })
        : new Promise<ProbeResult>((resolve) => probes.pending.set(era.id, resolve)),
  };
});

vi.mock("@/lib/historical/futureFloodplains", () => ({
  loadFloodplain: vi.fn(async () => ({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } }],
  })),
}));

vi.mock("@/lib/historical/welikia1609", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/historical/welikia1609")>();
  return {
    ...actual,
    loadWelikia1609Features: vi.fn(async () => ({ type: "FeatureCollection", features: [] })),
  };
});

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

function eraLayers(map: FakeMap) {
  return map.getLayersOrder().filter((id) => /^(era-|welikia-1609-|floodplain-)/.test(id));
}

function eraSources(map: FakeMap) {
  return [...map.sources.keys()].filter((id) => /^(era-|welikia-1609-|floodplain-)/.test(id));
}

const baseSaturation = (map: FakeMap) => map.getPaintProperty("satellite", "raster-saturation");

let map: FakeMap;
let statuses: ImageryStatus[];
const onStatus = (status: ImageryStatus) => statuses.push(status);

beforeEach(() => {
  map = new FakeMap();
  statuses = [];
  probes.auto = true;
  probes.pending.clear();
  probes.verdict.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EraRasterLayer: every timeline entry", () => {
  it.each(ERAS.filter((era) => era.kind !== "live").map((era) => [era.id, era] as const))(
    "%s installs its own layer and nothing from another year",
    async (_id, era) => {
      render(<EraRasterLayer map={map.asMap()} era={era} onStatusChange={onStatus} />);
      await flush();

      for (const id of eraSources(map)) {
        expect(id).toContain(era.id);
      }
      if (era.tiles) {
        const source = map.sources.get(`era-${era.id}-src`)!;
        expect(source.tiles).toEqual([era.tiles]);
        expect(source.maxzoom).toBe(era.maxzoom);
        if (era.bounds) expect(source.bounds).toEqual(era.bounds);
        expect(map.getLayer(`era-${era.id}-layer`)).toBeDefined();
      }
      expect(statuses[0]).toEqual({ phase: "loading" });
    }
  );

  it("reports Today as ready without drawing anything", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("today")} onStatusChange={onStatus} />);
    await flush();
    expect(eraLayers(map)).toEqual([]);
    expect(statuses).toEqual([{ phase: "ready" }]);
  });
});

describe("EraRasterLayer: layer order and the base imagery", () => {
  it("draws the aerial directly over the base imagery, under hillshade, labels and analysis", async () => {
    map.addSource("risk", { type: "geojson" });
    map.addLayer({ id: "risk-zones-layer", type: "fill", source: "risk" });
    render(<EraRasterLayer map={map.asMap()} era={getEra("1951")} />);
    await flush();
    expect(map.getLayersOrder()).toEqual([
      "satellite",
      "era-1951-layer",
      "hillshade",
      "place-labels",
      "risk-zones-layer",
    ]);
  });

  it("keeps the 1609 blocks above the 1609 raster, whichever installs first", async () => {
    probes.auto = false;
    render(<EraRasterLayer map={map.asMap()} era={getEra("1609")} />);
    await flush();
    act(() => probes.pending.get("1609")!({ ok: true }));
    await flush();
    const order = map.getLayersOrder();
    expect(order.indexOf("era-1609-layer")).toBeLessThan(order.indexOf("welikia-1609-blocks-fill"));
    expect(order.indexOf("welikia-1609-blocks-line")).toBeLessThan(order.indexOf("hillshade"));
  });

  it("greys today's imagery under the past, and restores it on the way back", async () => {
    const view = render(<EraRasterLayer map={map.asMap()} era={getEra("1924")} />);
    await flush();
    expect(baseSaturation(map)).toBe(-1);
    view.rerender(<EraRasterLayer map={map.asMap()} era={getEra("fp-2050")} />);
    await flush();
    expect(baseSaturation(map)).toBe(0);
    view.unmount();
    expect(baseSaturation(map)).toBe(0);
  });

  it("greys today's imagery immediately, before the probe answers", async () => {
    probes.auto = false;
    render(<EraRasterLayer map={map.asMap()} era={getEra("1924")} />);
    expect(baseSaturation(map)).toBe(-1);
    expect(eraLayers(map)).toEqual([]);
  });
});

describe("EraRasterLayer: switching years", () => {
  it("leaves only the final year after rapid switching, whatever order probes answer in", async () => {
    probes.auto = false;
    const view = render(<EraRasterLayer map={map.asMap()} era={getEra("1924")} onStatusChange={onStatus} />);
    view.rerender(<EraRasterLayer map={map.asMap()} era={getEra("1951")} onStatusChange={onStatus} />);
    view.rerender(<EraRasterLayer map={map.asMap()} era={getEra("1996")} onStatusChange={onStatus} />);
    view.rerender(<EraRasterLayer map={map.asMap()} era={getEra("2006")} onStatusChange={onStatus} />);

    // Answers arrive late and out of order.
    act(() => probes.pending.get("2006")!({ ok: true }));
    act(() => probes.pending.get("1924")!({ ok: true }));
    act(() => probes.pending.get("1996")!({ ok: true }));
    act(() => probes.pending.get("1951")!({ ok: false, phase: "unavailable", message: "gone" }));
    await flush();

    expect(eraSources(map)).toEqual(["era-2006-src"]);
    expect(eraLayers(map)).toEqual(["era-2006-layer"]);
    expect(statuses.some((status) => status.phase === "unavailable")).toBe(false);
  });

  it("never duplicates a source when styledata fires repeatedly", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("2016")} />);
    await flush();
    for (let i = 0; i < 5; i += 1) map.emit("styledata");
    expect(eraSources(map)).toEqual(["era-2016-src"]);
    expect(eraLayers(map)).toEqual(["era-2016-layer"]);
  });

  it("removes its layer, source and every listener on unmount", async () => {
    const before = map.listenerCount();
    const view = render(<EraRasterLayer map={map.asMap()} era={getEra("1609")} />);
    await flush();
    expect(map.listenerCount()).toBeGreaterThan(before);
    view.unmount();
    expect(eraLayers(map)).toEqual([]);
    expect(eraSources(map)).toEqual([]);
    expect(map.listenerCount()).toBe(before);
  });

  it("goes back to today with no historical layer left behind", async () => {
    const view = render(<EraRasterLayer map={map.asMap()} era={getEra("2018")} />);
    await flush();
    view.rerender(<EraRasterLayer map={map.asMap()} era={getEra("today")} />);
    await flush();
    expect(eraLayers(map)).toEqual([]);
    expect(baseSaturation(map)).toBe(0);
  });
});

describe("EraRasterLayer: style reloads", () => {
  it("reinstalls after an imagery provider swap wipes the style", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("1924")} onStatusChange={onStatus} />);
    await flush();
    act(() => map.emit("sourcedata", { sourceId: "era-1924-src", tile: {} }));
    expect(statuses.at(-1)).toEqual({ phase: "ready" });

    // setStyle: the style is briefly unloaded, then everything custom is gone.
    map.style._loaded = false;
    map.resetStyle();
    act(() => map.emit("styledata"));
    expect(eraLayers(map)).toEqual([]);
    map.style._loaded = true;
    act(() => map.emit("style.load"));

    expect(eraLayers(map)).toEqual(["era-1924-layer"]);
    expect(map.getLayersOrder()[1]).toBe("era-1924-layer");
    expect(baseSaturation(map)).toBe(-1);
    expect(statuses.at(-1)).toEqual({ phase: "loading" });
  });

  it("installs while tiles are still streaming, not only once the map is idle", async () => {
    // MapLibre's isStyleLoaded() is false while any tile is in flight.
    (map as unknown as { isStyleLoaded: () => boolean }).isStyleLoaded = () => false;
    render(<EraRasterLayer map={map.asMap()} era={getEra("1951")} />);
    await flush();
    expect(eraLayers(map)).toEqual(["era-1951-layer"]);
  });
});

describe("EraRasterLayer: failures", () => {
  it("draws nothing for an unavailable year and says so", async () => {
    probes.verdict.set("1996", {
      ok: false,
      phase: "unavailable",
      message: "1996 imagery is unavailable: the publisher answered 404.",
    });
    render(<EraRasterLayer map={map.asMap()} era={getEra("1996")} onStatusChange={onStatus} />);
    await flush();
    expect(eraLayers(map)).toEqual([]);
    expect(statuses.at(-1)).toMatchObject({ phase: "unavailable", retriable: false });
    // Still not today's imagery passing as 1996.
    expect(baseSaturation(map)).toBe(-1);
  });

  it("ignores events from other sources", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("1924")} onStatusChange={onStatus} />);
    await flush();
    act(() => {
      for (let i = 0; i < 10; i += 1) map.emit("error", { sourceId: "terrarium" });
      map.emit("sourcedata", { sourceId: "satellite", tile: {} });
    });
    expect(statuses.at(-1)).toEqual({ phase: "loading" });
  });

  it("reloads the source once on hard tile failures, then offers a retry", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("2018")} onStatusChange={onStatus} />);
    await flush();
    const failAll = () =>
      act(() => {
        for (let i = 0; i < MAX_TILE_FAILURES; i += 1) map.emit("error", { sourceId: "era-2018-src" });
      });
    failAll();
    expect(eraLayers(map)).toEqual(["era-2018-layer"]); // reinstalled after the reload
    expect(statuses.at(-1)?.phase).toBe("loading");
    failAll();
    expect(statuses.at(-1)).toMatchObject({ phase: "error", retriable: true });
  });

  it("reports an empty view when every requested tile is missing (404s are silent)", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("1951")} onStatusChange={onStatus} />);
    await flush();
    act(() => map.emit("idle"));
    expect(statuses.at(-1)).toMatchObject({ phase: "empty" });
    act(() => map.emit("sourcedata", { sourceId: "era-1951-src", tile: {} }));
    expect(statuses.at(-1)).toEqual({ phase: "ready" });
  });

  it("times out a layer that never receives a tile", async () => {
    vi.useFakeTimers();
    render(<EraRasterLayer map={map.asMap()} era={getEra("2006")} onStatusChange={onStatus} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(FIRST_TILE_TIMEOUT_MS + 1);
    });
    expect(statuses.at(-1)).toMatchObject({ phase: "error", retriable: true });
  });

  it("starts over when the user retries", async () => {
    probes.verdict.set("2016", { ok: false, phase: "error", message: "offline" });
    const view = render(
      <EraRasterLayer map={map.asMap()} era={getEra("2016")} onStatusChange={onStatus} retryToken={0} />
    );
    await flush();
    expect(statuses.at(-1)?.phase).toBe("error");
    probes.verdict.delete("2016");
    view.rerender(
      <EraRasterLayer map={map.asMap()} era={getEra("2016")} onStatusChange={onStatus} retryToken={1} />
    );
    await flush();
    expect(eraLayers(map)).toEqual(["era-2016-layer"]);
    expect(statuses.at(-1)?.phase).toBe("loading");
  });
});

describe("FloodplainLayer status", () => {
  it("reports ready once the city's polygons arrive", async () => {
    render(<EraRasterLayer map={map.asMap()} era={getEra("fp-2080")} onStatusChange={onStatus} />);
    await flush();
    expect(statuses.at(-1)).toEqual({ phase: "ready" });
    const order = map.getLayersOrder();
    expect(order.indexOf("floodplain-fp-2080-fill")).toBeLessThan(order.indexOf("hillshade"));
  });

  it("reports a retriable error when NYC Open Data fails", async () => {
    const { loadFloodplain } = await import("@/lib/historical/futureFloodplains");
    vi.mocked(loadFloodplain).mockRejectedValueOnce(new Error("503"));
    render(<EraRasterLayer map={map.asMap()} era={getEra("fp-2100")} onStatusChange={onStatus} />);
    await flush();
    expect(statuses.at(-1)).toMatchObject({ phase: "error", retriable: true });
  });
});
