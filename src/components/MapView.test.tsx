import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapCameraState } from "@/lib/counterfactual/types";
import { MapView, type MapViewHandle } from "./MapView";
import { RELIEF_RISE_FROM } from "@/lib/terrain-relief";
import {
  HILLSHADE_EXAGGERATION_RELIEF,
  TERRARIUM_SOURCE_ID,
  autoTerrainExaggeration,
  metersPerPixel,
  terrainExaggerationForZoom,
  terrainPitchForZoom,
  terrainSky,
} from "@/lib/terrain-scene";

const maplibre = vi.hoisted(() => {
  type Listener = (event: unknown) => void;

  class MockMap {
    static instances: MockMap[] = [];

    listeners = new Map<string, Listener[]>();
    center: { lng: number; lat: number };
    zoom: number;
    bearing: number;
    pitch: number;

    addControl = vi.fn();
    setStyle = vi.fn();
    remove = vi.fn();
    flyTo = vi.fn();
    fitBounds = vi.fn();
    jumpTo = vi.fn((camera: MapCameraState) => {
      this.center = { lng: camera.center[0], lat: camera.center[1] };
      this.zoom = camera.zoom;
      this.bearing = camera.bearing;
      this.pitch = camera.pitch;
    });
    sources = new Set<string>();
    layers = new Set<string>();
    terrain: { source: string; exaggeration: number } | null = null;

    getSource = vi.fn((id: string) =>
      this.sources.has(id) ? { id } : undefined
    );
    addSource = vi.fn((id: string) => {
      this.sources.add(id);
    });
    getLayer = vi.fn((id: string) =>
      this.layers.has(id) ? { id } : undefined
    );
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.add(layer.id);
    });
    removeLayer = vi.fn((id: string) => {
      this.layers.delete(id);
    });
    setPaintProperty = vi.fn();
    setLayoutProperty = vi.fn();
    setTerrain = vi.fn(
      (terrain: { source: string; exaggeration: number } | null) => {
        this.terrain = terrain;
      }
    );
    getTerrain = vi.fn(() => this.terrain);
    queryTerrainElevation?: (lngLat: [number, number]) => number | null;
    isSourceLoaded?: (id: string) => boolean;
    setSky = vi.fn();
    setLight = vi.fn();
    easeTo = vi.fn();
    isStyleLoaded = vi.fn(() => true);
    getLayoutProperty = vi.fn(() => "visible");
    triggerRepaint = vi.fn();
    getCanvas = vi.fn(() => ({
      toDataURL: vi.fn(() => "data:image/jpeg;base64,test"),
    }));
    getBounds = vi.fn(() => ({
      getWest: () => -74.1,
      getSouth: () => 40.6,
      getEast: () => -73.9,
      getNorth: () => 40.8,
    }));

    constructor(options: {
      center: [number, number];
      zoom: number;
      bearing?: number;
      pitch?: number;
    }) {
      this.center = { lng: options.center[0], lat: options.center[1] };
      this.zoom = options.zoom;
      this.bearing = options.bearing ?? 0;
      this.pitch = options.pitch ?? 0;
      MockMap.instances.push(this);
    }

    on(event: string, listener: Listener) {
      this.listeners.set(event, [
        ...(this.listeners.get(event) ?? []),
        listener,
      ]);
      return this;
    }

    once(event: string, listener: Listener) {
      return this.on(event, listener);
    }

    off(event: string, listener: Listener) {
      this.listeners.set(
        event,
        (this.listeners.get(event) ?? []).filter((item) => item !== listener)
      );
      return this;
    }

    emit(event: string, payload: unknown = {}) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(payload);
      }
    }

    getCenter() {
      return this.center;
    }

    getZoom() {
      return this.zoom;
    }

    getBearing() {
      return this.bearing;
    }

    getPitch() {
      return this.pitch;
    }
  }

  return { MockMap };
});

vi.mock("maplibre-gl", () => ({
  default: {
    Map: maplibre.MockMap,
    NavigationControl: class NavigationControl {},
    GeolocateControl: class GeolocateControl {},
    ScaleControl: class ScaleControl {},
  },
  Map: maplibre.MockMap,
}));

/** The reduced-motion path commits each relief change without animating. */
function preferReducedMotion() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...original(query),
    matches: query.includes("prefers-reduced-motion"),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

function currentMap() {
  const map = maplibre.MockMap.instances.at(-1);
  if (!map) throw new Error("MapView did not construct a MapLibre map");
  return map;
}

describe("MapView camera contract", () => {
  beforeEach(() => {
    maplibre.MockMap.instances.length = 0;
  });

  it("reports the live map and imperative handle when imagery is ready", () => {
    const onReady = vi.fn();
    const ref = createRef<MapViewHandle>();

    render(<MapView ref={ref} onReady={onReady} />);
    const map = currentMap();
    act(() => map.emit("sourcedata", { tile: {} }));

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({
      map,
      handle: ref.current,
    });
    expect(ref.current?.getMap()).toBe(map);
  });

  it("does not echo a controlled camera jump through change callbacks", () => {
    const onCameraChange = vi.fn();
    const onViewChange = vi.fn();
    const initial: MapCameraState = {
      center: [-73.985, 40.758],
      zoom: 15,
      bearing: 0,
      pitch: 0,
    };
    const controlled: MapCameraState = {
      center: [-74.01, 40.71],
      zoom: 13,
      bearing: 12,
      pitch: 28,
    };

    const view = render(
      <MapView
        camera={initial}
        onCameraChange={onCameraChange}
        onViewChange={onViewChange}
      />
    );
    const map = currentMap();
    view.rerender(
      <MapView
        camera={controlled}
        onCameraChange={onCameraChange}
        onViewChange={onViewChange}
      />
    );

    expect(map.jumpTo).toHaveBeenCalledWith(controlled);
    act(() => map.emit("moveend"));
    expect(onCameraChange).not.toHaveBeenCalled();
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("emits the full camera for a user-driven moveend", () => {
    const onCameraChange = vi.fn();
    const onViewChange = vi.fn();
    render(
      <MapView
        onCameraChange={onCameraChange}
        onViewChange={onViewChange}
      />
    );
    const map = currentMap();
    map.center = { lng: -73.97, lat: 40.75 };
    map.zoom = 16;
    map.bearing = 19;
    map.pitch = 35;

    act(() => map.emit("moveend"));

    expect(onCameraChange).toHaveBeenCalledWith({
      center: [-73.97, 40.75],
      zoom: 16,
      bearing: 19,
      pitch: 35,
    });
    expect(onViewChange).toHaveBeenCalledWith({
      lat: 40.75,
      lng: -73.97,
      zoom: 16,
    });
  });

  it("ignores terrain overlay failures while imagery is still connecting", () => {
    render(<MapView />);
    const map = currentMap();

    act(() => {
      map.emit("error", { sourceId: "osm-buildings", error: new Error("buildings") });
      map.emit("error", { sourceId: "terrarium", error: new Error("dem") });
      map.emit("error", { sourceId: "terrarium", error: new Error("dem again") });
    });

    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it("pitches into zoom-scaled relief and restores a flat map", () => {
    const restoreMotion = preferReducedMotion();
    const view = render(<MapView initialZoom={15} />);
    const map = currentMap();

    view.rerender(<MapView initialZoom={15} terrainEnabled />);

    expect(map.setTerrain).toHaveBeenCalledWith({
      source: TERRARIUM_SOURCE_ID,
      exaggeration: RELIEF_RISE_FROM,
    });
    expect(map.setTerrain).toHaveBeenLastCalledWith({
      source: TERRARIUM_SOURCE_ID,
      exaggeration: terrainExaggerationForZoom(15),
    });
    expect(map.setSky).toHaveBeenCalledWith(terrainSky());
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: terrainPitchForZoom(15) })
    );
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      "hillshade",
      "hillshade-exaggeration",
      HILLSHADE_EXAGGERATION_RELIEF
    );
    expect(map.layers.has("osm-buildings-3d")).toBe(true);

    const exaggeration = map.terrain?.exaggeration ?? 1;
    const hills = Array.from({ length: 121 }, (_, index) => (index % 11) * 4);
    let sample = 0;
    map.queryTerrainElevation = vi.fn(() => hills[sample++ % hills.length] * exaggeration);
    map.isSourceLoaded = vi.fn(() => true);
    act(() => map.emit("idle"));
    const spanMeters = 1024 * metersPerPixel(map.center.lat, 15);
    expect(map.setTerrain).toHaveBeenLastCalledWith({
      source: TERRARIUM_SOURCE_ID,
      exaggeration: autoTerrainExaggeration(hills, spanMeters),
    });

    view.rerender(<MapView initialZoom={15} terrainEnabled={false} />);
    expect(map.terrain).toBeNull();
    expect(map.setSky).toHaveBeenLastCalledWith(
      expect.objectContaining({ "fog-ground-blend": 0, "atmosphere-blend": 0 })
    );
    restoreMotion();
  });

  it("raises the ground from nearly flat after the tilt starts", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    try {
      const onReliefChange = vi.fn();
      const view = render(<MapView initialZoom={15} onReliefChange={onReliefChange} />);
      const map = currentMap();

      view.rerender(
        <MapView
          initialZoom={15}
          terrainEnabled
          terrainExaggeration={3}
          onReliefChange={onReliefChange}
        />
      );
      expect(map.terrain?.exaggeration).toBe(RELIEF_RISE_FROM);

      act(() => {
        vi.advanceTimersByTime(2500);
      });
      const midway = map.terrain?.exaggeration ?? 0;
      expect(midway).toBeGreaterThan(RELIEF_RISE_FROM);
      expect(midway).toBeLessThan(3);
      expect(map.triggerRepaint).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(map.setTerrain).toHaveBeenLastCalledWith({
        source: TERRARIUM_SOURCE_ID,
        exaggeration: 3,
      });
      expect(onReliefChange).toHaveBeenLastCalledWith(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MapView 3D terrain contract", () => {
  let restoreMotion: () => void;
  beforeEach(() => {
    maplibre.MockMap.instances.length = 0;
    restoreMotion = preferReducedMotion();
  });
  afterEach(() => restoreMotion());

  it("applies 3D terrain elevation and eases camera pitch when terrain is enabled", () => {
    const view = render(<MapView terrainEnabled={false} />);
    const map = currentMap();

    expect(map.setTerrain).toHaveBeenLastCalledWith(null);

    view.rerender(<MapView terrainEnabled={true} terrainExaggeration={6.0} />);

    expect(map.setTerrain).toHaveBeenLastCalledWith({
      source: "terrarium",
      exaggeration: 6.0,
    });
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        pitch: 74,
      })
    );
  });

  it("updates elevation exaggeration when terrainExaggeration prop changes", () => {
    const view = render(<MapView terrainEnabled={true} terrainExaggeration={3.5} />);
    const map = currentMap();

    expect(map.setTerrain).toHaveBeenLastCalledWith({
      source: "terrarium",
      exaggeration: 3.5,
    });

    view.rerender(<MapView terrainEnabled={true} terrainExaggeration={10.0} />);

    expect(map.setTerrain).toHaveBeenLastCalledWith({
      source: "terrarium",
      exaggeration: 10.0,
    });
  });
});
