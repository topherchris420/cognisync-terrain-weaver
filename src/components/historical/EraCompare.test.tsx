import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMap } from "@/test/fake-map";
import type { MapViewProps } from "@/components/MapView";
import type { ProbeResult } from "@/lib/historical/era-imagery";
import { EraCompare } from "./EraCompare";

const panes = vi.hoisted(() => ({
  maps: [] as FakeMap[],
  props: [] as MapViewProps[],
  delayed: false,
  release: null as (() => void) | null,
  verdict: new Map<string, ProbeResult>(),
}));

// Each pane is a FakeMap handed over through onReady, as the real MapView does
// once its first imagery tile arrives.
vi.mock("@/components/MapView", () => ({
  MapView: (props: MapViewProps) => {
    const index = panes.props.length;
    panes.props.push(props);
    useEffect(() => {
      const map = new FakeMap();
      panes.maps[index] = map;
      const ready = () => props.onReady?.({ map: map.asMap(), handle: {} as never });
      if (panes.delayed && index === 2) panes.release = ready;
      else ready();
      return () => {
        map.removed = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="map-view" />;
  },
}));

vi.mock("@/lib/historical/era-imagery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/historical/era-imagery")>();
  return {
    ...actual,
    probeEraImageryCached: (era: { id: string }) =>
      Promise.resolve(panes.verdict.get(era.id) ?? { ok: true }),
  };
});

vi.mock("@/lib/historical/welikia1609", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/historical/welikia1609")>();
  return {
    ...actual,
    loadWelikia1609Features: vi.fn(async () => ({ type: "FeatureCollection", features: [] })),
  };
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

const eraLayers = (map: FakeMap) => map.getLayersOrder().filter((id) => id.startsWith("era-"));

function renderCompare(props: Partial<Parameters<typeof EraCompare>[0]> = {}) {
  return render(
    <EraCompare
      open
      onClose={() => {}}
      center={{ lat: 40.758, lng: -73.985 }}
      zoom={14}
      initialEraIds={["1924", "today", "2018"]}
      {...props}
    />
  );
}

beforeEach(() => {
  panes.maps = [];
  panes.props = [];
  panes.verdict.clear();
  panes.delayed = false;
  panes.release = null;
});

describe("EraCompare", () => {
  it("gives each pane its own year, imagery and provenance", async () => {
    renderCompare();
    await flush();
    expect(eraLayers(panes.maps[0])).toEqual(["era-1924-layer"]);
    expect(eraLayers(panes.maps[1])).toEqual([]);
    expect(eraLayers(panes.maps[2])).toEqual(["era-2018-layer"]);
    expect(panes.maps[0].getPaintProperty("satellite", "raster-saturation")).toBe(-1);
    expect(panes.maps[1].getPaintProperty("satellite", "raster-saturation")).toBeUndefined();

    const first = screen.getByTestId("era-pane-0");
    expect(first).toHaveTextContent("Observed");
    expect(first).toHaveTextContent(/1924 aerial survey/);
    expect(screen.getByTestId("era-pane-2")).toHaveTextContent(/New York State Orthoimagery Program/);
  });

  it("keeps the three cameras in step", async () => {
    renderCompare();
    await flush();
    const [a, b, c] = panes.maps;
    act(() => a.jumpTo({ center: { lng: -74.0, lat: 40.71 }, zoom: 16, bearing: -24, pitch: 60 }));
    for (const other of [b, c]) {
      expect(other.getCenter()).toEqual({ lng: -74.0, lat: 40.71 });
      expect(other.getZoom()).toBe(16);
      expect(other.getBearing()).toBe(-24);
      expect(other.getPitch()).toBe(60);
    }
  });

  it("changes one pane's year without disturbing the others", async () => {
    renderCompare();
    await flush();
    fireEvent.change(screen.getByLabelText("Era for pane 3"), { target: { value: "1951" } });
    await flush();
    expect(eraLayers(panes.maps[2])).toEqual(["era-1951-layer"]);
    expect([...panes.maps[2].sources.keys()]).toEqual(["era-1951-src"]);
    expect(eraLayers(panes.maps[0])).toEqual(["era-1924-layer"]);
  });

  it("removes its camera listeners when it closes", async () => {
    const view = renderCompare();
    await flush();
    const before = panes.maps.map((map) => map.listeners.get("move")?.length ?? 0);
    expect(before).toEqual([1, 1, 1]);
    view.rerender(
      <EraCompare open={false} onClose={() => {}} center={{ lat: 40.758, lng: -73.985 }} zoom={14} />
    );
    await flush();
    expect(panes.maps.map((map) => map.listeners.get("move")?.length ?? 0)).toEqual([0, 0, 0]);
  });

  it("mirrors 3D terrain, with today's buildings only in the present", async () => {
    renderCompare({ terrainEnabled: true });
    await flush();
    const latest = panes.props.slice(-3);
    expect(latest.map((p) => p.terrainEnabled)).toEqual([true, true, true]);
    expect(latest.map((p) => p.presentDayBuildings)).toEqual([false, true, false]);
  });

  it("explains an unavailable year in its own pane", async () => {
    panes.verdict.set("1924", {
      ok: false,
      phase: "unavailable",
      message: "1924 imagery is unavailable: the publisher answered 404.",
    });
    renderCompare();
    await flush();
    expect(eraLayers(panes.maps[0])).toEqual([]);
    expect(screen.getByTestId("era-pane-0")).toHaveTextContent(/Unavailable.*answered 404/);
    expect(eraLayers(panes.maps[2])).toEqual(["era-2018-layer"]);
  });
});

describe("comparison recovery and accessibility", () => {
  it("aligns a late-loading pane with the camera already in use", async () => {
    panes.delayed = true;
    renderCompare();
    await flush();
    act(() => panes.maps[0].jumpTo({ center: { lng: -74.02, lat: 40.72 }, zoom: 17, bearing: 32, pitch: 45 }));
    act(() => panes.release?.());
    await flush();
    expect(panes.maps[2].getCenter()).toEqual({ lng: -74.02, lat: 40.72 });
    expect(panes.maps[2].getZoom()).toBe(17);
    expect(panes.maps[2].getBearing()).toBe(32);
    expect(panes.maps[2].getPitch()).toBe(45);
  });

  it("updates coverage when a synchronized camera leaves and returns to NYC", async () => {
    renderCompare();
    await flush();
    act(() => {
      panes.maps[0].jumpTo({ center: { lng: -104.99, lat: 39.74 } });
      panes.maps[0].emit("moveend");
    });
    expect(screen.getByTestId("era-pane-0")).toHaveTextContent(/covers the city only/);
    expect(screen.getByTestId("era-pane-2")).toHaveTextContent(/covers the city only/);
    expect(screen.getByTestId("era-pane-1")).not.toHaveTextContent(/covers the city only/);
    act(() => {
      panes.maps[1].jumpTo({ center: { lng: -73.985, lat: 40.758 } });
      panes.maps[1].emit("moveend");
    });
    expect(screen.getByTestId("era-pane-0")).not.toHaveTextContent(/covers the city only/);
  });

  it("closes with Escape and returns focus to the opening control", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Compare eras</button>
        {open && <EraCompare open onClose={() => setOpen(false)} center={{ lat: 40.758, lng: -73.985 }} zoom={14} />}</>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Compare eras" });
    trigger.focus();
    fireEvent.click(trigger);
    await flush();
    expect(screen.getByRole("dialog", { name: /Same place/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("switches to flat terrain when the viewport becomes narrow", async () => {
    let resize = () => {};
    const media = { matches: false, addEventListener: vi.fn((_event, callback) => { resize = callback; }), removeEventListener: vi.fn() };
    const spy = vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    try {
      const view = renderCompare({ terrainEnabled: true, terrainExaggeration: 3 });
      await flush();
      expect(panes.props.slice(-3).map((p) => p.terrainExaggeration)).toEqual([3, 3, 3]);
      act(() => { media.matches = true; resize(); });
      expect(panes.props.slice(-3).map((p) => p.terrainEnabled)).toEqual([false, false, false]);
      expect(screen.getByText(/flat on small screens/)).toBeVisible();
      view.unmount();
      expect(media.removeEventListener).toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
