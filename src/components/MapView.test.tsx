import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapCameraState } from "@/lib/counterfactual/types";
import { MapView, type MapViewHandle } from "./MapView";

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
    getLayer = vi.fn(() => undefined);
    setLayoutProperty = vi.fn();
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
});
