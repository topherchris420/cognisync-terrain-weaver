export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export const PRESETS: Array<{ label: string; lat: number; lng: number; zoom: number }> = [
  { label: "Manhattan, NY", lat: 40.758, lng: -73.985, zoom: 15 },
  { label: "Jakarta, ID", lat: -6.2088, lng: 106.8456, zoom: 14 },
  { label: "Copenhagen, DK", lat: 55.6761, lng: 12.5683, zoom: 14 },
  { label: "Lagos, NG", lat: 6.5244, lng: 3.3792, zoom: 14 },
  { label: "Phoenix, AZ", lat: 33.4484, lng: -112.074, zoom: 14 },
];

/**
 * Free-text location search against OpenStreetMap Nominatim. No API key.
 *
 * Never throws: geocoding is a convenience over the map, and a failure here
 * must not block panning and zooming by hand. Callers get an empty array.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(trimmed)}&format=json&limit=5`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const items = (await res.json()) as NominatimItem[];
    return items
      // Nominatim returns coordinates as strings. A malformed entry yields NaN,
      // and Number("") coerces an empty string to 0 -- a deceptively
      // "in-range" point -- either of which would fly the map to a broken
      // location. Require a non-blank, finite, in-range point before mapping.
      .filter(
        (item) =>
          item.lat.trim() !== "" &&
          item.lon.trim() !== "" &&
          Number.isFinite(Number(item.lat)) &&
          Number.isFinite(Number(item.lon)) &&
          Math.abs(Number(item.lat)) <= 90 &&
          Math.abs(Number(item.lon)) <= 180
      )
      .map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }));
  } catch {
    return [];
  }
}
