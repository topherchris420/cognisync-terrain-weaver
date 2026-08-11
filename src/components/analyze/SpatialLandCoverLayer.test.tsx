import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { SpatialLandCoverLayer } from "./SpatialLandCoverLayer";
import { SourceInspector } from "./SourceInspector";
import type {
  SpatialContextResult,
  SpatialFeatureInspection,
  SpatialFeatureProperties,
} from "@/lib/spatial-data/types";

const treeFeature: GeoJSON.Feature<GeoJSON.Point, SpatialFeatureProperties> = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-74.005, 40.71] },
  properties: {
    featureId: "tree-1",
    surfaceClass: "tree-observation",
    sourceId: "nyc-tree-inventory",
    confidence: "medium",
    observedAt: "2015",
    scientificStatus: "observed",
  },
};
const context: SpatialContextResult = {
  featureCollection: { type: "FeatureCollection", features: [treeFeature] },
  coverage: { status: "partial", requestedAreaM2: 100, classifiedAreaM2: 0 },
  provenance: [],
  warnings: ["Official vector coverage is partial."],
  loadedSourceIds: ["nyc-tree-inventory"],
  failedSourceIds: [],
};

function createMapMock() {
  const layers = new Set<string>();
  const sources = new Set<string>();
  return {
    addSource: vi.fn((id: string) => sources.add(id)),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    getLayer: vi.fn((id: string) => layers.has(id) ? { id } : undefined),
    getSource: vi.fn((id: string) => sources.has(id) ? { setData: vi.fn() } : undefined),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    on: vi.fn(),
    off: vi.fn(),
    getCanvas: vi.fn(() => ({ style: { cursor: "" } })),
  };
}

describe("SpatialLandCoverLayer", () => {
  it("keeps tree observations as points and reports inspectable provenance", () => {
    const map = createMapMock();
    const onInspect = vi.fn();
    render(<SpatialLandCoverLayer
      map={map as unknown as MapLibreMap}
      context={context}
      onInspect={onInspect}
    />);
    const addSourceCalls = map.addSource.mock.calls as unknown as unknown[][];
    const source = addSourceCalls[0][1] as { data: GeoJSON.FeatureCollection };
    expect(source.data.features[0].geometry.type).toBe("Point");
    const onCalls = map.on.mock.calls as unknown as unknown[][];
    const click = onCalls.find(
      ([event, layer]) => event === "click" && String(layer).includes("tree-observations")
    );
    click?.[2]({ features: [treeFeature] });
    expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({
      surfaceClass: "tree-observation",
      sourceId: "nyc-tree-inventory",
      observedAt: "2015",
      confidence: "medium",
      geometryStatus: "point observation",
      caveats: expect.arrayContaining([expect.stringMatching(/point/i)]),
    }));
  });

  it("removes only its prefixed layers and source on cleanup", () => {
    const map = createMapMock();
    const { unmount } = render(<SpatialLandCoverLayer
      map={map as unknown as MapLibreMap}
      context={context}
      onInspect={() => undefined}
    />);
    unmount();
    expect(map.removeLayer).toHaveBeenCalled();
    for (const [id] of map.removeLayer.mock.calls) {
      expect(id).toMatch(/^mannahatta-spatial-context/);
    }
    for (const [id] of map.removeSource.mock.calls) {
      expect(id).toMatch(/^mannahatta-spatial-context/);
    }
  });
});

describe("SourceInspector", () => {
  it("shows exact source facts and affected metrics", () => {
    const inspection: SpatialFeatureInspection = {
      featureId: "tree-1",
      surfaceClass: "tree-observation",
      sourceId: "nyc-tree-inventory",
      observedAt: "2015",
      confidence: "medium",
      geometryStatus: "point observation",
      caveats: ["Tree records are points, not canopy polygons."],
      agency: "NYC Department of Parks & Recreation",
      availability: "live",
      processingMethod: "Official point observations clipped to the request.",
      officialUrl: "https://data.cityofnewyork.us/",
      affectedMetrics: ["provenance only"],
    };
    const view = render(<SourceInspector inspection={inspection} />);
    expect(view.getByText("2015")).toBeInTheDocument();
    expect(view.getByText(/NYC Department of Parks/)).toBeInTheDocument();
    expect(view.getByText("point observation")).toBeInTheDocument();
    expect(view.getByText(/provenance only/i)).toBeInTheDocument();
    expect(view.queryByText("2026")).not.toBeInTheDocument();
  });
});
