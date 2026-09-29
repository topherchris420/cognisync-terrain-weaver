import { area as turfArea } from "@turf/turf";
import { stableHash } from "@/lib/counterfactual/hashing";
import { interventionParameters } from "@/lib/counterfactual/intervention-parameters";
import type { InterventionFeature, InterventionType } from "@/lib/counterfactual/types";
import type { ElevationGrid, SimExtent } from "@/lib/hydrology/types";
import type { FixtureLoader } from "./experiment";
import type { StudyArea } from "./study-areas";

export interface DemFixture {
  area: StudyArea;
  terrarium: Record<string, { status: string; hash: string; centimetres: number[][] }>;
  /** Absent for sampled tiles beyond the first 40 (Addendum 1). */
  threeDep72: number[][] | null;
}

export function demPath(areaId: string): string {
  return `dem/${areaId}.json`;
}

/** Elevation grid exactly as the engine consumes it, from frozen centimetres. */
export function elevationFromFixture(
  load: FixtureLoader,
  areaId: string,
  source: "terrarium" | "3dep",
  size = 72,
): ElevationGrid {
  const fixture = load<DemFixture>(demPath(areaId)).data;
  const centimetres = source === "3dep" ? (size === 72 ? fixture.threeDep72 : null) : fixture.terrarium[String(size)]?.centimetres;
  if (!centimetres) throw new Error(`No ${source} ${size}×${size} grid for ${areaId}.`);
  const values = centimetres.map((row) => row.map((v) => v / 100));
  return {
    values,
    rows: values.length,
    cols: values[0].length,
    status: "observed",
    hash: stableHash(values),
    sourceId: source === "3dep" ? "usgs-3dep-bare-earth" : "mapzen-terrarium",
    warnings: [],
  };
}

export function hasThreeDep(load: FixtureLoader, areaId: string): boolean {
  return load<DemFixture>(demPath(areaId)).data.threeDep72 !== null;
}

export function studyAreas(load: FixtureLoader): StudyArea[] {
  const data = load<{ named: StudyArea[]; sampled: StudyArea[] }>("areas.json").data;
  return [...data.named, ...data.sampled];
}

const M_PER_DEG_LAT = 111_320;

/**
 * A square intervention of (approximately) `areaM2`, centred at a fraction of
 * the extent, treated as fully eligible. Stands in for a drawn polygon.
 */
export function squareIntervention(
  type: InterventionType,
  bbox: SimExtent,
  areaM2: number,
  at: [number, number] = [0.5, 0.5],
  id = `${type}-${areaM2}`,
): InterventionFeature {
  const side = Math.sqrt(areaM2);
  const lat = bbox.south + (bbox.north - bbox.south) * at[1];
  const lng = bbox.west + (bbox.east - bbox.west) * at[0];
  const dLat = side / M_PER_DEG_LAT / 2;
  const dLng = side / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)) / 2;
  const geometry: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [[
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ]],
  };
  const validAreaM2 = turfArea(geometry);
  return {
    id,
    type,
    geometry,
    areaM2: validAreaM2,
    parameters: interventionParameters(type),
    eligibility: {
      eligible: true,
      validGeometry: geometry,
      invalidGeometry: null,
      validAreaM2,
      invalidAreaM2: 0,
      reasonCodes: [],
      confidence: "medium",
      provenance: [],
      caveats: ["Synthetic experiment geometry; eligibility assumed, not evaluated against mapped surfaces."],
    },
    provenance: [],
  };
}
