import {
  assessScenario,
  DEFAULT_ASSUMPTIONS,
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  normalizeScenario,
  type Scenario,
  type ScenarioImpact,
} from "@/lib/scenario";
import type { FloodRisk, LandCover, LandCoverKey } from "@/lib/types";
import {
  area as turfArea,
  difference,
  feature,
  featureCollection,
  union,
} from "@turf/turf";
import { stableHash } from "./hashing";
import type { InterventionFeature } from "./types";

export interface ProjectedMetrics {
  status: "estimated until storm rerun" | "modeled";
  scenarioImpact: ScenarioImpact;
  estimatedRunoffM3: number;
  estimatedRisk: FloodRisk;
  surfaceHash: string;
  warnings: string[];
}

export interface ProjectEditMetricsInput {
  features: InterventionFeature[];
  cover: LandCover;
  siteAreaM2: number;
  rainfallMm: number;
  gridShape: { rows: number; cols: number };
  modeledSurfaceHash?: string | null;
}

const LAND_KEYS = [
  "vegetation",
  "soil",
  "buildings",
  "pavement",
] as const;

function landShare(cover: LandCover, key: LandCoverKey): number {
  const land = LAND_KEYS.reduce(
    (sum, candidate) => sum + (Number(cover[candidate]) || 0),
    0
  );
  return land > 0 ? (Number(cover[key]) || 0) / land : 0;
}

export function deriveScenarioFromFeatures(
  features: InterventionFeature[],
  cover: LandCover,
  siteAreaM2: number
): Scenario {
  const scenario = { ...EMPTY_SCENARIO };
  const area =
    Number.isFinite(siteAreaM2) && siteAreaM2 > 0 ? siteAreaM2 : 0;
  if (area === 0) return scenario;

  const claimedBySource = new Map<
    string,
    GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
  >();
  for (const key of INTERVENTION_ORDER) {
    const source = INTERVENTIONS[key].source;
    const availableAreaM2 = area * landShare(cover, source);
    if (availableAreaM2 <= 0) continue;
    const valid = features
      .filter(
        (candidate) =>
          candidate.type === key &&
          candidate.eligibility.eligible &&
          candidate.eligibility.validGeometry
      )
      .map((candidate) => feature(candidate.eligibility.validGeometry!));
    if (valid.length === 0) continue;
    let merged = valid[0];
    for (const candidate of valid.slice(1)) {
      try {
        merged =
          union(featureCollection([merged, candidate])) ?? merged;
      } catch {
        // Skip malformed geometry rather than overstate unique edited area.
      }
    }
    const previouslyClaimed = claimedBySource.get(source);
    let unclaimed: GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    > | null = merged;
    if (previouslyClaimed) {
      try {
        unclaimed =
          difference(featureCollection([merged, previouslyClaimed])) ??
          null;
      } catch {
        unclaimed = null;
      }
    }
    const editedAreaM2 = unclaimed ? turfArea(unclaimed) : 0;
    scenario[key] = editedAreaM2 / availableAreaM2;
    if (previouslyClaimed) {
      try {
        claimedBySource.set(
          source,
          union(featureCollection([previouslyClaimed, merged])) ??
            previouslyClaimed
        );
      } catch {
        // Retain the prior claim: a failed union must not create extra area.
      }
    } else {
      claimedBySource.set(source, merged);
    }
  }

  return normalizeScenario(scenario);
}

function canonicalFeatures(features: InterventionFeature[]) {
  return features
    .filter(
      (candidate) =>
        candidate.eligibility.eligible &&
        candidate.eligibility.validGeometry !== null
    )
    .map((candidate) => ({
      type: candidate.type,
      geometry: candidate.eligibility.validGeometry,
      validAreaM2: candidate.eligibility.validAreaM2,
      parameters: {
        retentionFractionDelta:
          candidate.parameters.retentionFractionDelta,
        storageDeltaMm: candidate.parameters.storageDeltaMm,
        roughnessDelta: candidate.parameters.roughnessDelta,
      },
    }))
    .sort((left, right) =>
      stableHash(left).localeCompare(stableHash(right))
    );
}

function projectionWarnings(features: InterventionFeature[]): string[] {
  const warnings = new Set<string>();
  for (const candidate of features) {
    if (
      !candidate.eligibility.eligible ||
      !candidate.eligibility.validGeometry
    ) {
      continue;
    }
    if (
      candidate.parameters.storageDeltaMm === 0 &&
      candidate.parameters.calibrationProvenance.length === 0
    ) {
      warnings.add(
        "Storage depth remains zero because no calibration provenance is loaded."
      );
    }
    if (
      candidate.parameters.roughnessDelta === 0 &&
      candidate.parameters.calibrationProvenance.length === 0
    ) {
      warnings.add(
        "Surface roughness remains zero because no calibration provenance is loaded."
      );
    }
    for (const caveat of candidate.eligibility.caveats) {
      warnings.add(caveat);
    }
  }
  return [...warnings];
}

export function projectEditMetrics(
  input: ProjectEditMetricsInput
): ProjectedMetrics {
  const siteAreaM2 =
    Number.isFinite(input.siteAreaM2) && input.siteAreaM2 > 0
      ? input.siteAreaM2
      : 0;
  const rainfallMm =
    Number.isFinite(input.rainfallMm) && input.rainfallMm > 0
      ? input.rainfallMm
      : 0;
  const scenario = deriveScenarioFromFeatures(
    input.features,
    input.cover,
    siteAreaM2
  );
  const scenarioImpact = assessScenario(
    input.cover,
    scenario,
    siteAreaM2,
    {
      ...DEFAULT_ASSUMPTIONS,
      annualRainfallMm: rainfallMm,
    }
  );
  const surfaceHash = stableHash({
    features: canonicalFeatures(input.features),
    gridShape: {
      rows: input.gridShape.rows,
      cols: input.gridShape.cols,
    },
  });
  const estimatedRunoffM3 =
    (siteAreaM2 *
      rainfallMm *
      (1 - scenarioImpact.projectedScore / 100)) /
    1000;

  return {
    status:
      input.modeledSurfaceHash === surfaceHash
        ? "modeled"
        : "estimated until storm rerun",
    scenarioImpact,
    estimatedRunoffM3: Math.max(0, estimatedRunoffM3),
    estimatedRisk: scenarioImpact.projectedRisk,
    surfaceHash,
    warnings: projectionWarnings(input.features),
  };
}
