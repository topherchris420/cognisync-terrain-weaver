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
  /** ISO local start/end of the event window. */
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

export function clearRealStormCache(): void {
  cache.clear();
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatLabel(startIso: string): string {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return startIso.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
  const events: RealStormEvent[] = [];
  let current: { startIdx: number; endIdx: number; total: number; peak: number } | null = null;
  let gapHours = 0;

  const flush = () => {
    if (!current) return;
    const hours = current.endIdx - current.startIdx + 1;
    if (current.total >= MIN_EVENT_MM) {
      const hyetograph: Array<{ tMin: number; rainMm: number }> = [];
      for (let i = current.startIdx; i <= current.endIdx; i += 1) {
        hyetograph.push({
          tMin: (i - current.startIdx) * 60,
          rainMm: Math.round(precipitationMm[i] * 100) / 100,
        });
      }
      const hyetographHash = stableHash(hyetograph);
      events.push({
        id: `storm:${hyetographHash}`,
        label: formatLabel(times[current.startIdx]),
        start: times[current.startIdx],
        end: times[current.endIdx],
        totalDepthMm: Math.round(current.total * 10) / 10,
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
        current = { startIdx: i, endIdx: i, total: rain, peak: rain };
      } else {
        current.endIdx = i;
        current.total += rain;
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
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<RealStormsResult> => {
    const end = new Date(Date.now() - 7 * 24 * 3600 * 1000);
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
        timezone: "auto",
      });
      const res = await fetchImpl(`${ARCHIVE_URL}?${params}`);
      if (!res.ok) {
        return { status: "unavailable", events: [], window, sourceLabel };
      }
      const body = (await res.json()) as {
        hourly?: { time?: string[]; precipitation?: number[] };
      };
      const times = body.hourly?.time ?? [];
      const rain = body.hourly?.precipitation ?? [];
      if (times.length === 0 || times.length !== rain.length) {
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
  return promise;
}
