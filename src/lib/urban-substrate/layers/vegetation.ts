import { geometryAreaM2 } from "../geometry";
import { quantizeLonLat, roundTo } from "../projection";
import type { RawPark, RawTree } from "../sources";
import type { AttributeSpec, ParkPropertyFeature, TreeFeature } from "../types";
import { byId, countIssues, inCanonicalOrder, integerId, normalizePolygonal, parseNumber, positiveOrNull, textOrNull } from "./common";

export const TREES_SOURCE = "nyc-street-tree-census-2015";
export const PARKS_SOURCE = "nyc-parks-properties";
const INCHES_TO_CM = 2.54;

export const VEGETATION_ATTRIBUTES: AttributeSpec[] = [
  { name: "trees.position", unit: null, evidence: "measured", source: TREES_SOURCE, field: "latitude, longitude", transform: "rounded to 1e-7°" },
  { name: "trees.dbhCm", unit: "cm", evidence: "measured", source: TREES_SOURCE, field: "tree_dbh", transform: "inches × 2.54; null where 0 or absent (stumps record 0)" },
  { name: "trees.status", unit: null, evidence: "measured", source: TREES_SOURCE, field: "status", transform: "as recorded in 2015 (Alive, Dead, Stump)" },
  { name: "parkProperties.geometry", unit: null, evidence: "reference", source: PARKS_SOURCE, field: "multipolygon", transform: "normalised like footprints; a property boundary, not vegetation" },
];

export interface VegetationStats {
  trees: { input: number; kept: number; dropped: Record<string, number>; missing: Record<string, number> };
  parks: { input: number; kept: number; dropped: Record<string, number>; issues: Record<string, number> };
}

export function normalizeTrees(rows: RawTree[]): { features: TreeFeature[]; stats: VegetationStats["trees"] } {
  const stats = { input: rows.length, kept: 0, dropped: {} as Record<string, number>, missing: { dbhCm: 0, speciesCommon: 0 } };
  const seen = new Set<string>();
  const features: TreeFeature[] = [];
  for (const row of inCanonicalOrder(rows)) {
    const treeId = integerId(row.tree_id);
    const lat = parseNumber(row.latitude);
    const lon = parseNumber(row.longitude);
    const id = treeId ? `tree:${treeId}` : null;
    const reason = !id ? "no-identifier" : seen.has(id) ? "duplicate-id" : lat === null || lon === null ? "no-position" : null;
    if (reason || !id || lat === null || lon === null) {
      stats.dropped[reason ?? "invalid"] = (stats.dropped[reason ?? "invalid"] ?? 0) + 1;
      continue;
    }
    seen.add(id);
    const dbh = positiveOrNull(row.tree_dbh);
    const feature: TreeFeature = {
      id,
      sourceId: TREES_SOURCE,
      position: quantizeLonLat([lon, lat]),
      status: textOrNull(row.status),
      speciesCommon: textOrNull(row.spc_common),
      dbhCm: dbh === null ? null : roundTo(dbh * INCHES_TO_CM, 1),
      health: textOrNull(row.health),
    };
    if (feature.dbhCm === null) stats.missing.dbhCm += 1;
    if (feature.speciesCommon === null) stats.missing.speciesCommon += 1;
    features.push(feature);
  }
  features.sort(byId);
  stats.kept = features.length;
  return { features, stats };
}

export function normalizeParks(rows: RawPark[]): { features: ParkPropertyFeature[]; stats: VegetationStats["parks"] } {
  const stats = { input: rows.length, kept: 0, dropped: {} as Record<string, number>, issues: {} as Record<string, number> };
  const seen = new Set<string>();
  const features: ParkPropertyFeature[] = [];
  for (const row of inCanonicalOrder(rows)) {
    const property = textOrNull(row.gispropnum);
    const id = property ? `park:${property}` : null;
    if (!id || seen.has(id)) {
      stats.dropped[id ? "duplicate-id" : "no-identifier"] = (stats.dropped[id ? "duplicate-id" : "no-identifier"] ?? 0) + 1;
      continue;
    }
    const { geometry, issues } = normalizePolygonal(row.multipolygon);
    countIssues(stats.issues, issues);
    if (!geometry) {
      stats.dropped["unusable-geometry"] = (stats.dropped["unusable-geometry"] ?? 0) + 1;
      continue;
    }
    seen.add(id);
    features.push({
      id,
      sourceId: PARKS_SOURCE,
      name: textOrNull(row.signname),
      typeCategory: textOrNull(row.typecategory),
      subcategory: textOrNull(row.subcategory),
      geometry,
      areaM2: roundTo(geometryAreaM2(geometry), 2),
      geometryIssues: issues,
    });
  }
  features.sort(byId);
  stats.kept = features.length;
  return { features, stats };
}
