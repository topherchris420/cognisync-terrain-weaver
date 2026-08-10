import { act, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { SpatialContextResult } from "@/lib/spatial-data/types";
import {
  MapEditor,
  type MapEditorHandle,
} from "./MapEditor";

const drawMocks = vi.hoisted(() => [] as Array<{
  add: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteAll: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  changeMode: ReturnType<typeof vi.fn>;
  state: GeoJSON.Feature[];
}>);

vi.mock("@mapbox/mapbox-gl-draw", () => ({
  default: class MockDraw {
    state: GeoJSON.Feature[] = [];
    add = vi.fn((input: GeoJSON.Feature | GeoJSON.FeatureCollection) => {
      this.state =
        input.type === "FeatureCollection" ? [...input.features] : [input];
      return this.state.map((feature) => String(feature.id));
    });
    delete = vi.fn((ids: string | string[]) => {
      const removed = new Set(Array.isArray(ids) ? ids : [ids]);
      this.state = this.state.filter(
        (feature) => !removed.has(String(feature.id))
      );
    });
    deleteAll = vi.fn(() => {
      this.state = [];
    });
    getAll = vi.fn(() => ({
      type: "FeatureCollection" as const,
      features: this.state,
    }));
    changeMode = vi.fn();
    constructor() {
      drawMocks.push(this);
    }
  },
}));
vi.mock("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css", () => ({}));

const polygon: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]],
};

const context: SpatialContextResult = {
  featureCollection: {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: polygon,
      properties: {
        featureId: "building",
        surfaceClass: "buildings",
        sourceId: "nyc-building-footprints",
        confidence: "high",
        scientificStatus: "observed",
      },
    }],
  },
  coverage: {
    status: "partial",
    requestedAreaM2: 1,
    classifiedAreaM2: 1,
  },
  provenance: [{
    sourceId: "nyc-building-footprints",
    title: "Buildings",
    agency: "NYC Office of Technology and Innovation",
    url: "https://data.cityofnewyork.us/",
    accessedAt: "2026-08-10",
    confidence: "high",
    status: "observed",
    caveats: [],
  }],
  warnings: [],
  loadedSourceIds: ["nyc-building-footprints"],
  failedSourceIds: [],
};

function createMapMock() {
  const handlers = new Map<string, (event: unknown) => void>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  const images = new Set<string>();
  return {
    handlers,
    addControl: vi.fn(),
    removeControl: vi.fn(),
    hasControl: vi.fn(() => true),
    on: vi.fn((event: string, handler: (event: unknown) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string) => handlers.delete(event)),
    addSource: vi.fn((id: string) => {
      sources.set(id, { setData: vi.fn() });
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    getLayer: vi.fn((id: string) => layers.has(id) ? { id } : undefined),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    addImage: vi.fn((id: string) => images.add(id)),
    hasImage: vi.fn((id: string) => images.has(id)),
    removeImage: vi.fn((id: string) => images.delete(id)),
  };
}

describe("MapEditor", () => {
  beforeEach(() => {
    drawMocks.length = 0;
  });

  it("creates, updates, and deletes controlled intervention features", async () => {
    const map = createMapMock();
    const onChange = vi.fn();
    const onDraftFeedback = vi.fn();
    const view = render(
      <MapEditor
        map={map as unknown as MapLibreMap}
        bbox={{ north: 1, south: 0, east: 1, west: 0 }}
        context={context}
        activeIntervention="green_roofs"
        features={[]}
        onChange={onChange}
        onDraftFeedback={onDraftFeedback}
      />
    );
    const draft = {
      type: "Feature" as const,
      id: "draft-1",
      properties: {},
      geometry: polygon,
    };

    act(() => map.handlers.get("draw.create")?.({ features: [draft] }));
    const created = onChange.mock.calls.at(-1)?.[0];
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: "draft-1",
      type: "green_roofs",
      eligibility: { eligible: true },
    });
    expect(onDraftFeedback).toHaveBeenCalled();

    view.rerender(
      <MapEditor
        map={map as unknown as MapLibreMap}
        bbox={{ north: 1, south: 0, east: 1, west: 0 }}
        context={context}
        activeIntervention="green_roofs"
        features={created}
        onChange={onChange}
        onDraftFeedback={onDraftFeedback}
      />
    );
    act(() => map.handlers.get("draw.update")?.({ features: [draft] }));
    expect(onChange.mock.calls.at(-1)?.[0]).toHaveLength(1);

    act(() => map.handlers.get("draw.delete")?.({ features: [draft] }));
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([]);
  });

  it("supports undo, clear, controlled reset, and tool mode changes", async () => {
    const map = createMapMock();
    const onChange = vi.fn();
    const ref = createRef<MapEditorHandle>();
    const props = {
      map: map as unknown as MapLibreMap,
      bbox: { north: 1, south: 0, east: 1, west: 0 },
      context,
      activeIntervention: "green_roofs" as const,
      features: [],
      onChange,
      onDraftFeedback: vi.fn(),
    };
    const view = render(<MapEditor ref={ref} {...props} />);
    const draft = {
      type: "Feature" as const,
      id: "draft-1",
      properties: {},
      geometry: polygon,
    };

    act(() => map.handlers.get("draw.create")?.({ features: [draft] }));
    const created = onChange.mock.calls.at(-1)?.[0];
    view.rerender(<MapEditor ref={ref} {...props} features={created} />);

    act(() => ref.current?.undo());
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([]);

    view.rerender(<MapEditor ref={ref} {...props} features={created} />);
    act(() => ref.current?.clear());
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([]);

    view.rerender(<MapEditor ref={ref} {...props} features={[]} />);
    await waitFor(() => expect(drawMocks[0].deleteAll).toHaveBeenCalled());
    expect(drawMocks[0].changeMode).toHaveBeenCalledWith("draw_polygon");
  });
});
