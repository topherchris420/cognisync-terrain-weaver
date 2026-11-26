import type { Map as MLMap } from "maplibre-gl";

type Listener = (event: unknown) => void;

interface FakeLayer {
  id: string;
  type?: string;
  source?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/**
 * Just enough of a MapLibre map to exercise overlay lifecycles: ordered
 * layers, sources, paint state, events and a style that can be "swapped".
 * Mirrors MapLibre's own rules where they matter — adding a duplicate source
 * or layer throws, and nothing can be added before the style has loaded.
 */
export class FakeMap {
  layers: FakeLayer[] = [];
  sources = new Map<string, Record<string, unknown>>();
  listeners = new Map<string, Listener[]>();
  style = { _loaded: true };
  center = { lng: -73.985, lat: 40.758 };
  zoom = 14;
  bearing = 0;
  pitch = 0;
  removed = false;
  container = document.createElement("div");
  resizeCount = 0;

  getContainer() { return this.container; }
  resize() { this.resizeCount += 1; return this; }

  constructor(baseLayers: string[] = ["satellite", "hillshade", "place-labels"]) {
    this.resetStyle(baseLayers);
  }

  /** What `setStyle` does: every custom source and layer is gone. */
  resetStyle(baseLayers: string[] = ["satellite", "hillshade", "place-labels"]) {
    this.layers = baseLayers.map((id) => ({ id, type: "raster", paint: {} }));
    this.sources = new Map();
  }

  private assertLoaded() {
    if (this.removed) throw new Error("Map has been removed");
    if (!this.style._loaded) throw new Error("Style is not done loading");
  }

  addSource(id: string, source: Record<string, unknown>) {
    this.assertLoaded();
    if (this.sources.has(id)) throw new Error(`Source "${id}" already exists.`);
    this.sources.set(id, source);
  }
  getSource(id: string) {
    const source = this.sources.get(id);
    return source ? { id, ...source, setData: (data: unknown) => (source.data = data) } : undefined;
  }
  removeSource(id: string) {
    if (this.layers.some((layer) => layer.source === id)) {
      throw new Error(`Source "${id}" cannot be removed while layer uses it.`);
    }
    this.sources.delete(id);
  }
  addLayer(layer: FakeLayer, beforeId?: string) {
    this.assertLoaded();
    if (this.layers.some((existing) => existing.id === layer.id)) {
      throw new Error(`Layer "${layer.id}" already exists.`);
    }
    if (layer.source && !this.sources.has(layer.source)) {
      throw new Error(`Source "${layer.source}" not found.`);
    }
    const copy = { ...layer, paint: { ...(layer.paint ?? {}) }, layout: { ...(layer.layout ?? {}) } };
    const index = beforeId ? this.layers.findIndex((l) => l.id === beforeId) : -1;
    if (index === -1) this.layers.push(copy);
    else this.layers.splice(index, 0, copy);
  }
  getLayer(id: string) {
    return this.layers.find((layer) => layer.id === id);
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }
  getLayersOrder() {
    return this.layers.map((layer) => layer.id);
  }
  setPaintProperty(id: string, name: string, value: unknown) {
    const layer = this.getLayer(id);
    if (!layer) throw new Error(`No layer ${id}`);
    layer.paint = { ...layer.paint, [name]: value };
  }
  getPaintProperty(id: string, name: string) {
    return this.getLayer(id)?.paint?.[name];
  }
  setLayoutProperty(id: string, name: string, value: unknown) {
    const layer = this.getLayer(id);
    if (layer) layer.layout = { ...layer.layout, [name]: value };
  }
  getLayoutProperty(id: string, name: string) {
    return this.getLayer(id)?.layout?.[name];
  }
  isStyleLoaded() {
    return this.style._loaded;
  }

  on(event: string, layerOrListener: string | Listener, maybeListener?: Listener) {
    const listener = typeof layerOrListener === "function" ? layerOrListener : maybeListener!;
    const key = typeof layerOrListener === "string" ? `${event}:${layerOrListener}` : event;
    this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
    return this;
  }
  once(event: string, listener: Listener) {
    return this.on(event, listener);
  }
  off(event: string, layerOrListener: string | Listener, maybeListener?: Listener) {
    const listener = typeof layerOrListener === "function" ? layerOrListener : maybeListener!;
    const key = typeof layerOrListener === "string" ? `${event}:${layerOrListener}` : event;
    this.listeners.set(key, (this.listeners.get(key) ?? []).filter((item) => item !== listener));
    return this;
  }
  emit(event: string, payload: unknown = {}) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload);
  }
  listenerCount() {
    let count = 0;
    for (const list of this.listeners.values()) count += list.length;
    return count;
  }

  getBounds() {
    return {
      getWest: () => -74.02,
      getSouth: () => 40.7,
      getEast: () => -73.95,
      getNorth: () => 40.78,
    };
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
  jumpTo(camera: { center?: { lng: number; lat: number }; zoom?: number; bearing?: number; pitch?: number }) {
    if (camera.center) this.center = camera.center;
    if (camera.zoom !== undefined) this.zoom = camera.zoom;
    if (camera.bearing !== undefined) this.bearing = camera.bearing;
    if (camera.pitch !== undefined) this.pitch = camera.pitch;
    this.emit("move");
  }
  getCanvas() {
    return { style: {} as Record<string, string> };
  }

  asMap() {
    return this as unknown as MLMap;
  }
}

/** A tiny but valid-looking PNG whose payload varies with `seed`. */
export function pngBytes(seed: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < bytes.length; i += 1) bytes[i] = (seed * 31 + i) & 0xff;
  return bytes;
}

export function tileResponse(bytes: Uint8Array, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => bytes.slice().buffer,
  } as unknown as Response;
}
