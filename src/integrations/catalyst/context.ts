import { BASELINE_SCORE } from "@/lib/baseline";
import { parseBBox } from "@/lib/geo";
import type { ScenarioExport } from "@/lib/scenario";
import type { SimulationResponse } from "@/lib/simulation-types";
import type { AnalysisRecord } from "@/lib/types";
import type { CatalystSiteContext } from "./types";

interface BuildCatalystContextOptions {
  scenarioExport?: ScenarioExport | null;
  rainfallMm?: number | null;
  simulationResult?: SimulationResponse | null;
}

function activeScenarioFromExport(
  payload?: ScenarioExport | null
): CatalystSiteContext["activeScenario"] {
  if (!payload) return undefined;
  const active = Object.entries(payload.scenario).find(([, fraction]) => fraction > 0);
  return {
    intervention: active?.[0],
    fraction: active?.[1],
    projectedScore: payload.impact.projectedScore,
    addedRetentionM3: payload.impact.addedRetentionM3,
    cost: payload.impact.capexUSD,
  };
}

function riskSummary(simulationResult?: SimulationResponse | null): string | undefined {
  if (!simulationResult) return undefined;
  const zones = simulationResult.risk_zones.length;
  const flows = simulationResult.flow_paths.length;
  return `${zones} risk zones and ${flows} flow paths returned by the active simulation.`;
}

export function buildCatalystSiteContext(
  analysis: AnalysisRecord,
  options: BuildCatalystContextOptions = {}
): CatalystSiteContext {
  const bbox = parseBBox(analysis.bbox);
  const score = Number(analysis.absorption_score);

  return {
    analysisId: analysis.id,
    location: {
      name: analysis.location_label ?? analysis.name,
      latitude: Number(analysis.center_lat),
      longitude: Number(analysis.center_lng),
      zoom: Number(analysis.zoom),
      ...(bbox
        ? { bbox: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]] }
        : {}),
    },
    present: {
      absorptionScore: score,
      landCover: {
        vegetation: Number(analysis.land_cover?.vegetation ?? 0),
        bareSoil: Number(analysis.land_cover?.soil ?? 0),
        buildings: Number(analysis.land_cover?.buildings ?? 0),
        pavement: Number(analysis.land_cover?.pavement ?? 0),
        water: Number(analysis.land_cover?.water ?? 0),
      },
      floodRisk: analysis.flood_risk,
    },
    historical1609: {
      absorptionScore: BASELINE_SCORE,
      deltaFromPresent: Math.round((BASELINE_SCORE - score) * 10) / 10,
      provenance: "estimated",
    },
    activeScenario: activeScenarioFromExport(options.scenarioExport),
    rainfall:
      typeof options.rainfallMm === "number" && Number.isFinite(options.rainfallMm)
        ? { depthMm: options.rainfallMm }
        : undefined,
    hydrology: options.simulationResult
      ? {
          riskSummary: riskSummary(options.simulationResult),
        }
      : undefined,
  };
}
