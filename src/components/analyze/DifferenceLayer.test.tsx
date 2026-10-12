import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { DIFFERENCE_FILL_ID, DIFFERENCE_SOURCE_ID, DifferenceLayer } from "./DifferenceLayer";
import { spatialDifference } from "@/lib/counterfactual/difference";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { routeWatershed, syntheticElevation } from "@/lib/hydrology";
import { squareIntervention } from "@/lib/validation/fixtures";
import { DIFFERENCE_LESS, DIFFERENCE_MORE } from "@/lib/water-palette";

vi.mock("maplibre-gl", () => ({ default: { Popup: vi.fn() } }));

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const elevation = syntheticElevation(bbox, 36, 36);
const base = { rainfallDepthMm: 50, durationMinutes: 60, resolution: "low" as const, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: "storm:test", elevation };
const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "surface:now" });
const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([squareIntervention("bioswales", bbox, 4000)], bbox, 36, 36), expectedElevationHash: now.elevationHash });

function createMapMock() {
  const layers = new Set<string>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  return {
    getStyle: vi.fn(() => ({})),
    addSource: vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    getCanvas: vi.fn(() => ({ style: { cursor: "" } })),
  };
}

describe("DifferenceLayer", () => {
  it("draws every changed cell, green where less water passes and amber where more, outlining the drawing", () => {
    const map = createMapMock();
    const difference = spatialDifference(now, possible);
    render(<DifferenceLayer map={map as unknown as MapLibreMap} difference={difference} extent={bbox} />);
    expect(map.addSource).toHaveBeenCalledWith(DIFFERENCE_SOURCE_ID, expect.objectContaining({ type: "geojson" }));
    const data = (map.addSource.mock.calls[0] as unknown[])[1] as { data: GeoJSON.FeatureCollection };
    if (difference.status !== "controlled") throw new Error("expected a controlled difference");
    expect(data.data.features).toHaveLength(difference.cells.length);
    const fill = (map.addLayer.mock.calls as unknown[][]).map((c) => c[0] as { id: string; paint: Record<string, unknown>; filter?: unknown }).find((l) => l.id === DIFFERENCE_FILL_ID)!;
    expect(JSON.stringify(fill.paint["fill-color"])).toContain(DIFFERENCE_LESS);
    expect(JSON.stringify(fill.paint["fill-color"])).toContain(DIFFERENCE_MORE);
    const outline = (map.addLayer.mock.calls as unknown[][]).map((c) => c[0] as { id: string; filter?: unknown }).find((l) => l.id !== DIFFERENCE_FILL_ID)!;
    expect(JSON.stringify(outline.filter)).toContain("source");
    expect(map.on).toHaveBeenCalledWith("click", DIFFERENCE_FILL_ID, expect.any(Function));
  });

  it("draws nothing for a pair that is not a controlled comparison", () => {
    const map = createMapMock();
    const heavier = routeWatershed({ ...base, rainfallDepthMm: 100, surfaceId: "possible", surfaceHash: "surface:possible" });
    render(<DifferenceLayer map={map as unknown as MapLibreMap} difference={spatialDifference(now, heavier)} extent={bbox} />);
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  it("removes only its own layers and source on unmount", () => {
    const map = createMapMock();
    const { unmount } = render(<DifferenceLayer map={map as unknown as MapLibreMap} difference={spatialDifference(now, possible)} extent={bbox} />);
    unmount();
    expect(map.removeLayer).toHaveBeenCalledTimes(2);
    for (const [id] of map.removeLayer.mock.calls) expect(id).toMatch(/^mannahatta-difference/);
    expect(map.removeSource).toHaveBeenCalledWith(DIFFERENCE_SOURCE_ID);
    expect(map.off).toHaveBeenCalledWith("click", DIFFERENCE_FILL_ID, expect.any(Function));
  });
});
