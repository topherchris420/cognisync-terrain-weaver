export type LandCoverKey =
  | "pavement"
  | "buildings"
  | "vegetation"
  | "water"
  | "soil";

export type LandCover = Record<LandCoverKey, number>;

export type FloodRisk = "low" | "moderate" | "high" | "unknown";

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "green" | "blue" | "gray";
}

export interface AnalysisRecord {
  id: string;
  name: string;
  location_label: string | null;
  center_lat: number;
  center_lng: number;
  zoom: number;
  bbox: unknown | null;
  image_data_url: string | null;
  land_cover: LandCover;
  absorption_score: number;
  flood_risk: FloodRisk;
  recommendations: Recommendation[];
  ai_notes: string | null;
  status: string;
  created_at: string;
}

export const LAND_COVER_META: Record<
  LandCoverKey,
  { label: string; token: string; hint: string }
> = {
  vegetation: {
    label: "Vegetation",
    token: "hsl(var(--surface-vegetation))",
    hint: "Absorbs rainfall, cools surface temperature",
  },
  soil: {
    label: "Bare soil",
    token: "hsl(var(--surface-soil))",
    hint: "Permeable, moderate absorption",
  },
  water: {
    label: "Water",
    token: "hsl(var(--surface-water))",
    hint: "Existing hydrological capacity",
  },
  buildings: {
    label: "Buildings",
    token: "hsl(var(--surface-building))",
    hint: "Impervious, runoff generator",
  },
  pavement: {
    label: "Pavement",
    token: "hsl(var(--surface-pavement))",
    hint: "Impervious, heat-island driver",
  },
};
