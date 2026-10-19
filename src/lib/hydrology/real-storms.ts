/**
 * Real recorded storms for a place, from the Open-Meteo historical archive
 * (ERA5/IFS reanalysis blended with station observations). No API key, global
 * coverage, hourly precipitation back decades.
 *
 * The archive lags real time by several days, so the window ends a week ago.
 * Events are detected from the hourly series: rainy hours (≥ 0.5 mm) merged
 * across gaps of up to 3 hours, keeping events with at least 10 mm total.
 */
import { stableHash } from "@/lib/counterfactual/hashing";

export interface RealStormEvent {
  id: string;
  /** Short human label, e.g. "29 Sep 2023". */
  label: string;
  /** ISO UTC start/end of the event window. */
  start: string;
  end: string;
  totalDepthMm: number;
  durationMinutes: number;
  peakIntensityMmH: number;
  /** Hourly rainfall within the event, minutes from event start. */
  hyetograph: Array<{ tMin: number; rainMm: number }>;
  /** Identity hash of the hyetograph — part of the storm seal. */
  hyetographHash: string;
}

export interface RealStormsResult {
  status: "observed" | "unavailable";
  events: RealStormEvent[];
  /** Window actually searched, ISO dates. */
  window: { start: string; end: string };
  sourceLabel: string;
}

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const MONTHS_BACK = 24;
const RAIN_HOUR_MM = 0.5;
const MAX_GAP_HOURS = 3;
const MIN_EVENT_MM = 10;
const MAX_EVENTS = 6;

const cache = new Map<string, Promise<RealStormsResult>>();

/** Missing or malformed archive hours cannot be presented as observed storms. */
function completeHourlySeries(times: string[], rain: Array<number | null>): rain is number[] {
  if (!times.length || times.length !== rain.length) return false;
  let previous = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(times[i])) return false;
    const timestamp = Date.parse(`${times[i]}Z`);
    if (!Number.isFinite(timestamp) || (i > 0 && timestamp - previous !== 3_600_000)) {
      return false;
    }
    if (typeof rain[i] !== "number" || !Number.isFinite(rain[i]) || rain[i] < 0) {
      return false;
    }
    previous = timestamp;
  }
  return true;
}

export function clearRealStormCache(): void {
  cache.clear();
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatLabel(startIso: string): string {
  const date = new Date(`${startIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return startIso.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Detect storm events in an hourly precipitation series. Pure and exported so
 * tests drive it without the network.
 */
export function detectStormEvents(
  times: string[],
  precipitationMm: number[]
): RealStormEvent[] {
  if (times.length !== precipitationMm.length ||
    precipitationMm.some((rain) => !Number.isFinite(rain) || rain < 0)) return [];

  const events: RealStormEvent[] = [];
  let current: { startIdx: number; endIdx: number; peak: number } | null = null;
  let gapHours = 0;

  const flush = () => {
    if (!current) return;
    const hours = current.endIdx - current.startIdx + 1;
    const hyetograph: Array<{ tMin: number; rainMm: number }> = [];
    for (let i = current.startIdx; i <= current.endIdx; i += 1) {
      hyetograph.push({
        tMin: (i - current.startIdx) * 60,
        rainMm: Math.round(precipitationMm[i] * 100) / 100,
      });
    }
    // Include intervening drizzle in both the event depth and the forcing
    // series. The two must agree or replay silently changes the storm.
    const totalDepthMm = Math.round(
      hyetograph.reduce((sum, hour) => sum + hour.rainMm, 0) * 100
    ) / 100;
    if (totalDepthMm >= MIN_EVENT_MM) {
      const hyetographHash = stableHash(hyetograph);
      events.push({
        id: `storm:${hyetographHash}`,
        label: formatLabel(times[current.startIdx]),
        start: times[current.startIdx],
        end: times[current.endIdx],
        totalDepthMm,
        durationMinutes: hours * 60,
        peakIntensityMmH: Math.round(current.peak * 100) / 100,
        hyetograph,
        hyetographHash,
      });
    }
    current = null;
  };

  for (let i = 0; i < times.length; i += 1) {
    const rain = precipitationMm[i] ?? 0;
    if (rain >= RAIN_HOUR_MM) {
      if (!current) {
        current = { startIdx: i, endIdx: i, peak: rain };
      } else {
        current.endIdx = i;
        current.peak = Math.max(current.peak, rain);
      }
      gapHours = 0;
    } else if (current) {
      gapHours += 1;
      if (gapHours > MAX_GAP_HOURS) flush();
    }
  }
  flush();

  return events
    .sort((a, b) => b.totalDepthMm - a.totalDepthMm)
    .slice(0, MAX_EVENTS);
}

/**
 * Fetch the strongest recorded storms near a point over the last two years.
 * Results are cached per ~1 km grid cell so re-opening the panel is instant.
 */
export function fetchRealStorms(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch
): Promise<RealStormsResult> {
  const end = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  // Refresh after the archive window advances, even in a long-lived tab.
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}:${toISODate(end)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<RealStormsResult> => {
    const start = new Date(end.getTime() - MONTHS_BACK * 30.44 * 24 * 3600 * 1000);
    const window = { start: toISODate(start), end: toISODate(end) };
    const sourceLabel = "Open-Meteo historical archive (ERA5/IFS reanalysis)";

    try {
      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lng.toFixed(4),
        start_date: window.start,
        end_date: window.end,
        hourly: "precipitation",
        timezone: "GMT",
      });
      const res = await fetchImpl(`${ARCHIVE_URL}?${params}`);
      if (!res.ok) {
        return { status: "unavailable", events: [], window, sourceLabel };
      }
      const body = (await res.json()) as {
        hourly?: { time?: string[]; precipitation?: Array<number | null> };
      };
      const times = body.hourly?.time ?? [];
      const rain = body.hourly?.precipitation ?? [];
      if (!completeHourlySeries(times, rain)) {
        return { status: "unavailable", events: [], window, sourceLabel };
      }
      return {
        status: "observed",
        events: detectStormEvents(times, rain),
        window,
        sourceLabel,
      };
    } catch {
      return { status: "unavailable", events: [], window, sourceLabel };
    }
  })();

  cache.set(key, promise);
  // A temporary API outage is not a durable result: permit the next retry.
  void promise.then((result) => {
    if (result.status === "unavailable" && cache.get(key) === promise) cache.delete(key);
  });
  return promise;
}
