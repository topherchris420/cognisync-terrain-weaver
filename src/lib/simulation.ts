import type { LandCoverKey } from "@/lib/types";
import type { BBox } from "@/lib/geo";
import { bboxAreaKm2 } from "@/lib/geo";
import type { SimulationRequest } from "@/lib/simulation-types";

/**
 * Runoff coefficient per land-cover class: the fraction of incident rain that
 * becomes surface runoff (`C` in the Rational Method, `Q = CiA`). These are the
 * complements of the absorption weights in `absorption.ts` — pavement and roofs
 * shed almost everything, vegetation and soil absorb most of it.
 */
export const RUNOFF_COEFFICIENT: Record<LandCoverKey, number> = {
  vegetation: 0.1, // high infiltration
  soil: 0.15,
  water: 0.5, // open water passes rain straight through to the receiving body
  buildings: 0.95, // roofs — effectively impervious
  pavement: 0.9, // asphalt and concrete
};

/**
 * Largest area (km²) the server engine will simulate. Mirrors the guard in
 * `supabase/functions/run-simulation/index.ts`; kept here so the client can
 * reject an oversized view with a helpful message before spending a round trip.
 */
export const MAX_SIMULATION_AREA_KM2 = 50;

/**
 * Convert a MapView bounding box (`[[west, south], [east, north]]`) into the
 * `{ north, south, east, west }` shape the `run-simulation` edge function wants.
 */
export function boundsToSimBBox(bounds: BBox): SimulationRequest["bbox"] {
  const [[west, south], [east, north]] = bounds;
  return { north, south, east, west };
}

/**
 * Mean runoff coefficient (0–1) for a land-cover mix — the share of incident
 * rain that runs off rather than soaking in. A quick, DEM-free estimate shown
 * before the full server simulation returns.
 */
export function runoffCoefficient(
  landCover: Record<LandCoverKey, number>
): number {
  let total = 0;
  let weighted = 0;
  for (const key of Object.keys(RUNOFF_COEFFICIENT) as LandCoverKey[]) {
    const pct = landCover[key] ?? 0;
    if (pct <= 0) continue;
    total += pct;
    weighted += RUNOFF_COEFFICIENT[key] * pct;
  }
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, weighted / total));
}

/**
 * Estimated surface-runoff volume (m³) for a rainfall depth falling on a bbox,
 * using the land-cover runoff coefficient. An instant client-side approximation
 * of what the flow-accumulation engine computes server-side:
 * `V = (rainfall_m × C) × area_m²`.
 */
export function estimateRunoffVolumeM3(
  landCover: Record<LandCoverKey, number>,
  rainfallMm: number,
  bbox: BBox
): number {
  if (rainfallMm <= 0) return 0;
  const areaM2 = bboxAreaKm2(bbox) * 1e6;
  const runoffDepthM = (rainfallMm / 1000) * runoffCoefficient(landCover);
  return Math.max(0, runoffDepthM * areaM2);
}

/**
 * Blue with intensity-scaled opacity, for rendering flow overlays.
 * @param intensity 0–1 flow intensity.
 */
export function getFlowColor(intensity: number): string {
  const clamped = Math.min(1, Math.max(0, intensity));
  const opacity = clamped * 0.8 + 0.2; // 0.2 floor so faint flows stay visible
  return `rgba(59, 130, 246, ${opacity})`; // Blue-500
}
