import { computeAbsorptionScore } from "@/lib/absorption";
import type { LandCover } from "@/lib/types";

/**
 * Real 1609 land cover, looked up per city block.
 *
 * The data behind this module is the Welikia Project's published reconstruction
 * of which ecological communities covered each New York City block in 1609,
 * reduced at build time by `scripts/build-welikia-1609-blocks.mjs` into a
 * bounding box plus a vegetation/soil/water mix per block. See that script for
 * exactly what is and is not transformed.
 *
 * This replaces the single island-wide *estimate* in `src/lib/baseline.ts` for
 * any site the reconstruction actually covers. Outside that footprint there is
 * no observation to report, and this module says so rather than guessing — the
 * caller is expected to fall back to the written baseline and label it as
 * modelled.
 */

/** [west, south, east, north, vegetation%, soil%, water%, communityIndex] */
type BlockRow = [number, number, number, number, number, number, number, number];

interface WelikiaPayload {
  version: number;
  source: {
    title: string;
    agency: string;
    url: string;
    accessedAt: string;
    method: string;
  };
  communities: string[];
  blocks: BlockRow[];
}

export interface Welikia1609Source {
  title: string;
  agency: string;
  url: string;
  accessedAt: string;
  method: string;
}

export interface Welikia1609Lookup {
  /** `observed` when Welikia blocks overlap the request, `unavailable` when not. */
  status: "observed" | "unavailable";
  /** Five-class cover for 1609. Buildings and pavement are always 0. */
  landCover: LandCover | null;
  /** 1609 absorption score under the same scorer used on live scans. */
  absorptionScore: number | null;
  /** How many reconstructed blocks fell inside the requested area. */
  blockCount: number;
  /** The ecological communities that dominated those blocks, most common first. */
  dominantCommunities: string[];
  source: Welikia1609Source;
  /** Plain-language reason shown when `status` is `unavailable`. */
  unavailableReason?: string;
}

export const WELIKIA_DATA_URL = "/data/welikia-1609-blocks.json";

/**
 * Extent of the reconstruction, used to distinguish "outside New York City" —
 * an expected, explainable miss — from "inside the city but no block here".
 */
const WELIKIA_EXTENT = {
  west: -74.28,
  south: 40.47,
  east: -73.68,
  north: 40.94,
} as const;

let payloadPromise: Promise<WelikiaPayload> | null = null;

/** Fetch (once) and cache the block index. */
export function loadWelikia1609(
  fetchImpl: typeof fetch = fetch
): Promise<WelikiaPayload> {
  if (!payloadPromise) {
    payloadPromise = fetchImpl(WELIKIA_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Welikia index unavailable (${response.status})`);
        }
        return response.json() as Promise<WelikiaPayload>;
      })
      .catch((error) => {
        payloadPromise = null;
        throw error;
      });
  }
  return payloadPromise;
}

/** Test seam: drop the cached index. */
export function resetWelikia1609Cache() {
  payloadPromise = null;
}

export interface Welikia1609Query {
  west: number;
  south: number;
  east: number;
  north: number;
}

function overlapArea(row: BlockRow, q: Welikia1609Query): number {
  const width = Math.min(row[2], q.east) - Math.max(row[0], q.west);
  const height = Math.min(row[3], q.north) - Math.max(row[1], q.south);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function intersectsExtent(q: Welikia1609Query): boolean {
  return (
    Math.min(q.east, WELIKIA_EXTENT.east) >
      Math.max(q.west, WELIKIA_EXTENT.west) &&
    Math.min(q.north, WELIKIA_EXTENT.north) >
      Math.max(q.south, WELIKIA_EXTENT.south)
  );
}

/**
 * Area-weighted 1609 cover for a bounding box.
 *
 * Each overlapping block contributes in proportion to how much of it falls in
 * the requested area, so a scan straddling marsh and forest reports the mix
 * rather than whichever block happened to be listed first.
 */
export function queryWelikia1609(
  payload: WelikiaPayload,
  query: Welikia1609Query
): Welikia1609Lookup {
  const source = payload.source;

  if (!intersectsExtent(query)) {
    return {
      status: "unavailable",
      landCover: null,
      absorptionScore: null,
      blockCount: 0,
      dominantCommunities: [],
      source,
      unavailableReason:
        "The 1609 reconstruction covers New York City only. There is no surveyed record of this ground.",
    };
  }

  let vegetation = 0;
  let soil = 0;
  let water = 0;
  let weight = 0;
  let blockCount = 0;
  const communityWeight = new Map<number, number>();

  for (const row of payload.blocks) {
    const area = overlapArea(row, query);
    if (area <= 0) continue;
    blockCount += 1;
    weight += area;
    vegetation += row[4] * area;
    soil += row[5] * area;
    water += row[6] * area;
    communityWeight.set(row[7], (communityWeight.get(row[7]) ?? 0) + area);
  }

  if (weight <= 0) {
    return {
      status: "unavailable",
      landCover: null,
      absorptionScore: null,
      blockCount: 0,
      dominantCommunities: [],
      source,
      unavailableReason:
        "No reconstructed block falls inside this view. Zoom out or pan over land within the five boroughs.",
    };
  }

  // Round to whole percent, then push any rounding remainder into the largest
  // class so the five classes always sum to exactly 100.
  const raw = {
    vegetation: vegetation / weight,
    soil: soil / weight,
    water: water / weight,
  };
  const rounded = {
    vegetation: Math.round(raw.vegetation),
    soil: Math.round(raw.soil),
    water: Math.round(raw.water),
  };
  const drift =
    100 - (rounded.vegetation + rounded.soil + rounded.water);
  if (drift !== 0) {
    const largest = (
      Object.keys(rounded) as (keyof typeof rounded)[]
    ).reduce((a, b) => (raw[a] >= raw[b] ? a : b));
    rounded[largest] += drift;
  }

  const landCover: LandCover = {
    vegetation: Math.max(0, rounded.vegetation),
    soil: Math.max(0, rounded.soil),
    water: Math.max(0, rounded.water),
    buildings: 0,
    pavement: 0,
  };

  const dominantCommunities = [...communityWeight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([index]) => payload.communities[index])
    .filter((name): name is string => Boolean(name));

  return {
    status: "observed",
    landCover,
    absorptionScore: computeAbsorptionScore(landCover),
    blockCount,
    dominantCommunities,
    source,
  };
}

/** Convenience: load the index and query it in one call. */
export async function lookupWelikia1609(
  query: Welikia1609Query,
  fetchImpl: typeof fetch = fetch
): Promise<Welikia1609Lookup> {
  const payload = await loadWelikia1609(fetchImpl);
  return queryWelikia1609(payload, query);
}
