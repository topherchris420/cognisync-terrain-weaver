import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_VIEW, mapViewUrl, readMapView } from "./map-view-link";

describe("shared map views", () => {
  it("round trips place, era and terrain while preserving other URL fields", () => {
    const view = { lat: 40.7075, lng: -74.009, zoom: 16, eraId: "2018", terrainEnabled: true, terrainExaggeration: 3 };
    const url = mapViewUrl("https://example.org/?source=bookmark#map", view);
    expect(readMapView(url.searchParams)).toEqual({ ...view, hasLocation: true });
    expect(url.searchParams.get("source")).toBe("bookmark");
    expect(url.hash).toBe("#map");
  });

  it.each(["lat=90&lng=0", "lat=NaN&lng=0", "lat=0&lng=181", "lat=%20&lng=0", "lng=1", "lat=1"])(
    "falls back safely for invalid coordinates: %s", (query) => {
      expect(readMapView(new URLSearchParams(query))).toMatchObject({ ...DEFAULT_MAP_VIEW, hasLocation: false });
    }
  );

  it("supports older location-only links and clamps zoom", () => {
    expect(readMapView(new URLSearchParams("lat=0&lng=0&zoom=100"))).toMatchObject({
      lat: 0, lng: 0, zoom: 19, hasLocation: true, eraId: "today", terrainEnabled: false, terrainExaggeration: null,
    });
  });

  it("rejects unknown era and relief values without enabling terrain", () => {
    expect(readMapView(new URLSearchParams("era=2099&terrain=true&relief=999"))).toMatchObject({
      eraId: "today", terrainEnabled: false, terrainExaggeration: null,
    });
  });

  it("removes old relief from a link when Auto is selected", () => {
    const url = mapViewUrl("https://example.org/?relief=6", {
      ...DEFAULT_MAP_VIEW, eraId: "today", terrainEnabled: true, terrainExaggeration: null,
    });
    expect(url.searchParams.has("relief")).toBe(false);
    expect(readMapView(url.searchParams).terrainExaggeration).toBeNull();
  });
});
