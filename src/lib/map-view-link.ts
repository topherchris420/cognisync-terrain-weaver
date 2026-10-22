import { DEFAULT_ERA_ID, getEra } from "@/lib/historical/eras";

export const DEFAULT_MAP_VIEW = { lat: 40.7075, lng: -74.009, zoom: 15 };
const MAX_MERCATOR_LATITUDE = 85.051129;

/** A map link is a view, never a saved analysis or a verified experiment. */
export function readMapView(params: URLSearchParams) {
  const rawLat = params.get("lat")?.trim();
  const rawLng = params.get("lng")?.trim();
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const hasLocation = Boolean(rawLat && rawLng) && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= MAX_MERCATOR_LATITUDE && Math.abs(lng) <= 180;
  const zoom = Number(params.get("zoom") || NaN);
  const relief = Number(params.get("relief"));
  return {
    hasLocation,
    ...(hasLocation
      ? { lat, lng, zoom: Number.isFinite(zoom) ? Math.min(19, Math.max(2, zoom)) : DEFAULT_MAP_VIEW.zoom }
      : DEFAULT_MAP_VIEW),
    eraId: getEra(params.get("era") ?? DEFAULT_ERA_ID).id,
    terrainEnabled: params.get("terrain") === "1",
    terrainExaggeration: [1, 3, 6].includes(relief) ? relief : null,
  };
}

export interface SharedMapView {
  lat: number;
  lng: number;
  zoom: number;
  eraId: string;
  terrainEnabled: boolean;
  terrainExaggeration: number | null;
}

export function mapViewUrl(href: string, view: SharedMapView): URL {
  const url = new URL(href);
  url.searchParams.set("lat", view.lat.toFixed(5));
  url.searchParams.set("lng", view.lng.toFixed(5));
  url.searchParams.set("zoom", view.zoom.toFixed(1));
  url.searchParams.set("era", getEra(view.eraId).id);
  url.searchParams.set("terrain", view.terrainEnabled ? "1" : "0");
  if (view.terrainExaggeration !== null && [1, 3, 6].includes(view.terrainExaggeration)) {
    url.searchParams.set("relief", String(view.terrainExaggeration));
  } else {
    url.searchParams.delete("relief");
  }
  return url;
}
