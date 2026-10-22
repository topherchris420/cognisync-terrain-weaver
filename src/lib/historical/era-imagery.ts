import { eraTileUrl, type MapEra } from "@/lib/historical/eras";

/**
 * Whether an era's imagery is actually there, and the state its layer is in.
 *
 * A tile server failing loudly is the easy case. The case that broke every
 * aerial year was a retired server answering HTTP 200 with the same "service
 * has moved" placeholder for every tile, which MapLibre draws without
 * complaint. So before an era is drawn, two tiles at different places are
 * fetched and checked: both must be real images, and they must differ. No
 * aerial photograph of two different city blocks is byte-identical.
 *
 * Loading → Ready / Empty / Unavailable / Error
 *   - Unavailable: the publisher definitively has no imagery (404, retired
 *     service, a placeholder, or HTML). Never retried.
 *   - Error: transient (network, 5xx, timeout). Retried a bounded number of
 *     times, then offered to the user as a manual retry.
 *   - Empty: the layer loaded, but nothing was published for this view.
 */

export type ImageryPhase = "loading" | "ready" | "empty" | "unavailable" | "error";

export interface ImageryStatus {
  phase: ImageryPhase;
  /** Plain-language explanation for every phase but `ready`. */
  message?: string;
  /** Whether a manual retry could help. */
  retriable?: boolean;
}

export function eraSourceId(era: Pick<MapEra, "id">) {
  return `era-${era.id}-src`;
}

export function eraLayerId(era: Pick<MapEra, "id">) {
  return `era-${era.id}-layer`;
}

export const LOADING: ImageryStatus = { phase: "loading" };
export const READY: ImageryStatus = { phase: "ready" };

export type ProbeResult =
  | { ok: true }
  | { ok: false; phase: "unavailable" | "error"; message: string };

/** Two land points every NYC layer covers: Midtown and City Hall. */
const PROBE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-73.985, 40.758],
  [-74.006, 40.7125],
];
const PROBE_ZOOM = 14;

export const PROBE_RETRIES = 2;
const PROBE_BACKOFF_MS = 500;
const PROBE_TIMEOUT_MS = 8_000;

/** Status codes that mean "this does not exist", not "try again". */
const DEFINITIVE_MISSING = new Set([400, 401, 403, 404, 410]);

export function lngLatToTile(lng: number, lat: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  );
  return { x, y, z: zoom };
}

export function probeUrls(era: MapEra): string[] {
  return PROBE_POINTS.map(([lng, lat]) => {
    const { x, y, z } = lngLatToTile(lng, lat, PROBE_ZOOM);
    return eraTileUrl(era, z, x, y);
  }).filter((url): url is string => Boolean(url));
}

/** PNG, JPEG, WebP or GIF by magic number, whatever the content type says. */
export function isImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const webp =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return png || jpeg || gif || webp;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

class Definitive extends Error {}

interface ProbeOptions {
  fetchImpl?: typeof fetch;
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchTile(
  url: string,
  { fetchImpl = fetch, retries = PROBE_RETRIES, backoffMs = PROBE_BACKOFF_MS, timeoutMs = PROBE_TIMEOUT_MS, sleep = wait }: ProbeOptions
): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      const response = await fetchImpl(url, { signal: controller?.signal, mode: "cors" });
      if (DEFINITIVE_MISSING.has(response.status)) {
        throw new Definitive(`the publisher answered ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isImageBytes(bytes)) {
        throw new Definitive("the publisher answered with something that is not an image");
      }
      return bytes;
    } catch (error) {
      if (error instanceof Definitive) throw error;
      lastError = error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("network failure");
}

/**
 * Check an era's tiles once, uncached. Transient failures are retried with
 * backoff up to `retries` times; a definitive answer stops at once.
 */
export async function probeEraImagery(
  era: MapEra,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const urls = probeUrls(era);
  if (urls.length === 0) return { ok: true };
  const label = era.label;
  try {
    const tiles = await Promise.all(urls.map((url) => fetchTile(url, options)));
    const placeholderCheck = era.kind === "raster" || era.kind === "reconstruction";
    if (placeholderCheck && tiles.length > 1 && sameBytes(tiles[0], tiles[1])) {
      return {
        ok: false,
        phase: "unavailable",
        message: `The ${label} service returns the same placeholder image everywhere instead of imagery, so nothing is drawn.`,
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Definitive) {
      return {
        ok: false,
        phase: "unavailable",
        message: `${label} imagery is unavailable: ${error.message}. Nothing is drawn in its place.`,
      };
    }
    return {
      ok: false,
      phase: "error",
      message: `${label} imagery could not be reached. Check the connection and retry.`,
    };
  }
}

/**
 * One probe per era and tile template. A definitive answer is kept for the
 * session; a transient error is dropped so the next attempt asks again. Keyed
 * by both, so one year's verdict can never stand in for another's.
 */
const probeCache = new Map<string, Promise<ProbeResult>>();

export function probeEraImageryCached(
  era: MapEra,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const key = `${era.id}|${era.tiles ?? ""}`;
  const hit = probeCache.get(key);
  if (hit) return hit;
  const pending = probeEraImagery(era, options).then((result) => {
    if (!result.ok && result.phase === "error") probeCache.delete(key);
    return result;
  });
  probeCache.set(key, pending);
  return pending;
}

export function forgetEraProbe(era: MapEra) {
  probeCache.delete(`${era.id}|${era.tiles ?? ""}`);
}

export function resetEraProbeCache() {
  probeCache.clear();
}

/* ------------------------------------------------------------------------ */
/* Layer state machine                                                       */
/* ------------------------------------------------------------------------ */

/** Hard tile failures (not 404s) tolerated before a reload. */
export const MAX_TILE_FAILURES = 4;
/** Automatic source reloads before the layer reports an error. */
export const MAX_AUTO_RELOADS = 1;
/** How long a layer may load without a single tile before it is an error. */
export const FIRST_TILE_TIMEOUT_MS = 25_000;

export interface ImageryTrackerState {
  status: ImageryStatus;
  loadedTiles: number;
  failedTiles: number;
  reloads: number;
}

export type ImageryEvent =
  | { type: "install" }
  | { type: "probe"; result: ProbeResult }
  | { type: "tile-loaded" }
  | { type: "tile-failed" }
  | { type: "idle" }
  | { type: "timeout" };

export const INITIAL_TRACKER: ImageryTrackerState = {
  status: LOADING,
  loadedTiles: 0,
  failedTiles: 0,
  reloads: 0,
};

function failed(state: ImageryTrackerState, label: string) {
  if (state.reloads < MAX_AUTO_RELOADS) {
    return {
      state: { ...state, status: LOADING, failedTiles: 0, reloads: state.reloads + 1 },
      reload: true,
    };
  }
  return {
    state: {
      ...state,
      status: {
        phase: "error" as const,
        message: `${label} tiles failed to load. Check the connection and retry.`,
        retriable: true,
      },
    },
    reload: false,
  };
}

/**
 * Advance the layer's state. `reload` asks the caller to drop and re-add the
 * source once, which clears tiles MapLibre has marked as errored.
 */
export function reduceImagery(
  state: ImageryTrackerState,
  event: ImageryEvent,
  label: string
): { state: ImageryTrackerState; reload: boolean } {
  const settled = state.status.phase === "unavailable" || state.status.phase === "error";
  switch (event.type) {
    case "install":
      if (settled) return { state, reload: false };
      return {
        state: { ...state, status: LOADING, loadedTiles: 0, failedTiles: 0 },
        reload: false,
      };
    case "probe":
      if (event.result.ok) return { state, reload: false };
      return {
        state: {
          ...state,
          status: {
            phase: event.result.phase,
            message: event.result.message,
            retriable: event.result.phase === "error",
          },
        },
        reload: false,
      };
    case "tile-loaded":
      if (settled) return { state, reload: false };
      return { state: { ...state, loadedTiles: state.loadedTiles + 1, status: READY }, reload: false };
    case "tile-failed": {
      if (settled) return { state, reload: false };
      const next = { ...state, failedTiles: state.failedTiles + 1 };
      if (next.loadedTiles === 0 && next.failedTiles >= MAX_TILE_FAILURES) return failed(next, label);
      return { state: next, reload: false };
    }
    case "idle":
      if (state.status.phase !== "loading" || state.loadedTiles > 0) return { state, reload: false };
      if (state.failedTiles > 0) return failed(state, label);
      return {
        state: {
          ...state,
          status: {
            phase: "empty",
            message: `No ${label} imagery was published for this view. Pan to the city's land area to see it.`,
          },
        },
        reload: false,
      };
    case "timeout":
      if (state.status.phase !== "loading" || state.loadedTiles > 0) return { state, reload: false };
      return {
        state: {
          ...state,
          status: {
            phase: "error",
            message: `${label} imagery is taking too long to arrive. Check the connection and retry.`,
            retriable: true,
          },
        },
        reload: false,
      };
  }
}
