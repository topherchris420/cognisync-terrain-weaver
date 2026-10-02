import { geometryAreaM2, geometryCentroidM, simplifyRing, positionsToLocal, ringToStored } from "../geometry";
import { FEET_TO_METRES, quantizeLonLat, roundTo, toLonLat } from "../projection";
import type { RawBuilding, RawPluto } from "../sources";
import type { AttributeSpec, BuildingFeature, BuildingLot, ContextBuildingFeature, Position } from "../types";
import { byId, countIssues, inCanonicalOrder, integerId, normalizePolygonal, parseNumber, positiveOrNull, textOrNull } from "./common";

export const BUILDINGS_SOURCE = "nyc-building-footprints";
export const PLUTO_SOURCE = "nyc-mappluto";

/** NYC Building Footprints data dictionary, FEATURE_CODE. */
export const BUILDING_FEATURE_TYPES: Record<string, string> = {
  "1000": "parking",
  "1001": "gas-station-canopy",
  "1002": "storage-tank",
  "1003": "placeholder",
  "1004": "auxiliary-structure",
  "1005": "temporary-structure",
  "1006": "cantilevered-building",
  "2100": "building",
  "2110": "skybridge",
  "5100": "under-construction",
  "5110": "garage",
};

/** Dummy BINs used by the city until a real one is assigned: not identifiers. */
const DUMMY_BINS = new Set(["1000000", "2000000", "3000000", "4000000", "5000000"]);

/** PLUTO LANDUSE codes (tax-lot land use). */
export const PLUTO_LAND_USE: Record<string, string> = {
  "1": "One & two family buildings",
  "2": "Multi-family walk-up buildings",
  "3": "Multi-family elevator buildings",
  "4": "Mixed residential & commercial buildings",
  "5": "Commercial & office buildings",
  "6": "Industrial & manufacturing",
  "7": "Transportation & utility",
  "8": "Public facilities & institutions",
  "9": "Open space & outdoor recreation",
  "10": "Parking facilities",
  "11": "Vacant land",
};

export const BUILDING_ATTRIBUTES: AttributeSpec[] = [
  { name: "footprint", unit: null, evidence: "measured", source: BUILDINGS_SOURCE, field: "the_geom", transform: "rounded to 1e-7°, rings closed and oriented; self-intersections flagged, not repaired" },
  { name: "footprintAreaM2", unit: "m²", evidence: "modeled", source: "derived", field: null, transform: "planar shoelace area in the substrate grid (≤0.33% scale error), outer minus holes" },
  { name: "roofPlanAreaM2", unit: "m²", evidence: "modeled", source: "derived", field: null, transform: "plan-view roof area taken as the footprint area; overhangs, setbacks and roof pitch ignored" },
  { name: "roofHeightM", unit: "m above ground", evidence: "measured", source: BUILDINGS_SOURCE, field: "height_roof", transform: "feet × 0.3048; null where the source records 0 or nothing (dictionary: not available)" },
  { name: "groundElevationM", unit: "m (NAVD88 where photogrammetric)", evidence: "measured", source: BUILDINGS_SOURCE, field: "ground_elevation", transform: "feet × 0.3048; null where absent" },
  { name: "constructionYear", unit: "year", evidence: "reported", source: BUILDINGS_SOURCE, field: "construction_year", transform: "integer; null where absent or 0" },
  { name: "featureType", unit: null, evidence: "measured", source: BUILDINGS_SOURCE, field: "feature_code", transform: "code mapped to the data dictionary label" },
  { name: "lot.landUse", unit: null, evidence: "reported", source: PLUTO_SOURCE, field: "landuse", transform: "joined by BBL (mappluto_bbl, else base_bbl); the tax lot's land use, not the building's" },
  { name: "lot.lotNumFloors", unit: "floors", evidence: "reported", source: PLUTO_SOURCE, field: "numfloors", transform: "floors of the tallest building on the lot; null where 0 or absent" },
];

export interface BuildingStats {
  input: number;
  kept: number;
  dropped: Record<string, number>;
  missing: Record<string, number>;
  issues: Record<string, number>;
}

export function normalizeBuildings(rows: RawBuilding[], plutoRows: RawPluto[]): { features: BuildingFeature[]; stats: BuildingStats } {
  const lots = new Map<string, RawPluto>();
  for (const row of inCanonicalOrder(plutoRows)) {
    const bbl = integerId(row.bbl);
    if (bbl) lots.set(bbl, row);
  }
  const stats: BuildingStats = {
    input: rows.length,
    kept: 0,
    dropped: {},
    missing: { roofHeightM: 0, groundElevationM: 0, constructionYear: 0, lot: 0, bin: 0 },
    issues: {},
  };
  const seen = new Set<string>();
  const features: BuildingFeature[] = [];
  for (const row of inCanonicalOrder(rows)) {
    const doittId = integerId(row.doitt_id);
    const rawBin = integerId(row.bin);
    const bin = rawBin && !DUMMY_BINS.has(rawBin) ? rawBin : null;
    const id = doittId ? `bldg:${doittId}` : bin ? `bldg:bin:${bin}` : null;
    if (!id || seen.has(id)) {
      stats.dropped[id ? "duplicate-id" : "no-identifier"] = (stats.dropped[id ? "duplicate-id" : "no-identifier"] ?? 0) + 1;
      continue;
    }
    const { geometry, issues } = normalizePolygonal(row.the_geom);
    if (!geometry) {
      stats.dropped["unusable-geometry"] = (stats.dropped["unusable-geometry"] ?? 0) + 1;
      countIssues(stats.issues, issues);
      continue;
    }
    seen.add(id);
    countIssues(stats.issues, issues);
    const area = roundTo(geometryAreaM2(geometry), 2);
    const [cx, cy] = geometryCentroidM(geometry);
    const height = positiveOrNull(row.height_roof);
    const ground = parseNumber(row.ground_elevation);
    const year = positiveOrNull(row.construction_year);
    const bbl = integerId(row.mappluto_bbl) ?? integerId(row.base_bbl);
    const lotRow = bbl ? lots.get(bbl) : undefined;
    const landUseCode = lotRow ? integerId(lotRow.landuse) : null;
    const lot: BuildingLot | null = lotRow && bbl
      ? {
          bbl,
          landUse: landUseCode,
          landUseLabel: landUseCode ? PLUTO_LAND_USE[landUseCode] ?? null : null,
          lotNumFloors: positiveOrNull(lotRow.numfloors),
          buildingClass: textOrNull(lotRow.bldgclass),
        }
      : null;
    const featureCode = integerId(row.feature_code);
    const feature: BuildingFeature = {
      id,
      sourceId: BUILDINGS_SOURCE,
      bin,
      doittId,
      footprint: geometry,
      centroid: quantizeLonLat(toLonLat(cx, cy)),
      footprintAreaM2: area,
      roofPlanAreaM2: area,
      roofHeightM: height === null ? null : roundTo(height * FEET_TO_METRES, 2),
      groundElevationM: ground === null ? null : roundTo(ground * FEET_TO_METRES, 2),
      constructionYear: year === null ? null : Math.round(year),
      featureCode,
      featureType: featureCode ? BUILDING_FEATURE_TYPES[featureCode] ?? null : null,
      geometrySource: textOrNull(row.geom_source),
      lot,
      geometryIssues: issues,
    };
    if (feature.roofHeightM === null) stats.missing.roofHeightM += 1;
    if (feature.groundElevationM === null) stats.missing.groundElevationM += 1;
    if (feature.constructionYear === null) stats.missing.constructionYear += 1;
    if (!feature.lot) stats.missing.lot += 1;
    if (!feature.bin) stats.missing.bin += 1;
    features.push(feature);
  }
  features.sort(byId);
  stats.kept = features.length;
  return { features, stats };
}

/** Context representation: simplified outer rings, height and area only. */
export function contextBuilding(building: BuildingFeature, toleranceM: number): ContextBuildingFeature | null {
  const polygons = (building.footprint.type === "Polygon" ? [building.footprint.coordinates] : building.footprint.coordinates) as Position[][][];
  const simplified = polygons
    .map((polygon) => simplifyRing(positionsToLocal(polygon[0]), toleranceM))
    .filter((ring): ring is NonNullable<typeof ring> => ring !== null)
    .map((ring) => ringToStored(ring))
    .filter((ring) => ring.length >= 4);
  if (simplified.length === 0) return null;
  return {
    id: building.id,
    footprint: simplified.length === 1 ? { type: "Polygon", coordinates: [simplified[0]] } : { type: "MultiPolygon", coordinates: simplified.map((ring) => [ring]) },
    footprintAreaM2: building.footprintAreaM2,
    roofHeightM: building.roofHeightM,
  };
}
