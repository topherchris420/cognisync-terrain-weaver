import type {
  DataProvenance,
  SpatialContextSnapshot,
} from "@/lib/counterfactual/types";

export type SpatialSurfaceClass =
  | "buildings"
  | "pavement"
  | "water"
  | "tree-observation"
  | "unclassified";

export type SpatialSourceAvailability =
  | "live"
  | "catalog-only"
  | "unavailable";

export interface SpatialBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SpatialFeatureProperties {
  featureId: string;
  surfaceClass: SpatialSurfaceClass;
  sourceId: string;
  confidence: "high" | "medium" | "low";
  observedAt?: string;
  scientificStatus: "observed" | "derived";
}

export type SpatialFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  SpatialFeatureProperties
>;

export interface SpatialSourceDefinition {
  id: string;
  title: string;
  agency: string;
  officialUrl: string;
  socrataResourceId?: string;
  geometryField?: string;
  featureIdFields: string[];
  latitudeField?: string;
  longitudeField?: string;
  geometryType: GeoJSON.Geometry["type"] | "raster" | "point-fields";
  displayClass: Exclude<SpatialSurfaceClass, "unclassified"> | null;
  observedAt?: string;
  accessedAt: string;
  crs: string;
  spatialResolutionM?: number;
  confidence: "high" | "medium" | "low";
  status: DataProvenance["status"];
  license: string;
  caveats: string[];
  availability: SpatialSourceAvailability;
  processingMethod: string;
  affectedMetrics: string[];
}

export interface EdgeSpatialContextResponse
  extends GeoJSON.FeatureCollection<GeoJSON.Geometry, SpatialFeatureProperties> {
  coverage: SpatialContextSnapshot["coverage"];
  provenance: DataProvenance[];
  warnings: string[];
  loadedSourceIds: string[];
  failedSourceIds: string[];
}

export interface SpatialContextResult extends SpatialContextSnapshot {
  featureCollection: GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    SpatialFeatureProperties
  >;
  loadedSourceIds: string[];
  failedSourceIds: string[];
}

export interface SpatialFeatureInspection {
  featureId: string;
  surfaceClass: SpatialSurfaceClass;
  sourceId: string;
  observedAt?: string;
  confidence: "high" | "medium" | "low";
  geometryStatus: string;
  caveats: string[];
  agency: string;
  availability: SpatialSourceAvailability;
  processingMethod: string;
  officialUrl: string;
  affectedMetrics: string[];
}
