import { BASELINE_SCORE } from "@/lib/baseline";
import { recordAreaM2 } from "@/lib/geo";
import {
  EMPTY_SCENARIO,
  INTERVENTIONS,
  INTERVENTION_ORDER,
  assessScenario,
  projectScore,
  type Scenario,
} from "@/lib/scenario";
import type { LandCover } from "@/lib/types";
import {
  CATALYST_TO_SCENARIO,
  SCENARIO_TO_CATALYST,
  catalystLabel,
  scenarioFromCatalystAction,
} from "./actions";
import { catalystExperimentSchema } from "./schema";
import type {
  CatalystAction,
  CatalystExperiment,
  CatalystIntervention,
  CatalystProvider,
  CatalystRequest,
  CatalystSiteContext,
  ScenarioVariant,
} from "./types";

const FIXED_LOCAL_ID = "MNH-CF-0042";

function contextCover(context: CatalystSiteContext): LandCover {
  return {
    vegetation: context.present.landCover.vegetation,
    soil: context.present.landCover.bareSoil,
    buildings: context.present.landCover.buildings,
    pavement: context.present.landCover.pavement,
    water: context.present.landCover.water ?? 0,
  };
}

function contextAreaM2(context: CatalystSiteContext): number {
  const bbox = context.location?.bbox;
  if (!bbox) return 0;
  return recordAreaM2({
    bbox: [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
  });
}

function experimentBase(
  context: CatalystSiteContext,
  fields: Pick<
    CatalystExperiment,
    | "hypothesis"
    | "objective"
    | "scientificStatus"
    | "actions"
    | "executionStatus"
  > &
    Partial<CatalystExperiment>
): CatalystExperiment {
  return catalystExperimentSchema.parse({
    id: FIXED_LOCAL_ID,
    assumptions: [
      "Current land-cover classification is accepted as the terrain input.",
      "Scenario effects use Mannahatta's existing absorption weights and Scenario Studio model.",
      `The 1609 baseline is an estimated benchmark scored by the same model, not block-specific historic GIS.`,
    ],
    claims: [
      {
        id: "claim-scenario-score",
        statement:
          "Projected score changes are deterministic consequences of the configured land-cover intervention.",
        status: "established",
        evidenceNeeded: ["Mannahatta land-cover mix", "Scenario Studio weights"],
      },
      {
        id: "claim-field-outcome",
        statement:
          "Real-world performance would require site survey, drainage data, maintenance assumptions, and monitored storm response.",
        status: "experimental",
        evidenceNeeded: ["As-built design", "Observed rainfall/runoff data"],
      },
    ],
    variables: [
      { name: "intervention fraction", role: "independent", unit: "fraction" },
      { name: "absorption score", role: "dependent", unit: "0-100" },
      { name: "current land cover", role: "control", unit: "percent" },
      { name: "historical benchmark", role: "control", unit: "score" },
    ],
    methodology: [
      "Compile the request into supported Mannahatta scenario actions.",
      "Run the existing Scenario Studio score projection against the active terrain context.",
      "Compare current, 1609 reference, and proposed future states using provenance labels.",
    ],
    successCriteria: ["SUPPORTED UNDER THIS SIMULATION if the modeled target is reached."],
    falsificationCriteria: [
      "NOT SUPPORTED UNDER THIS SIMULATION if the projected score remains below the stated target.",
      "INCONCLUSIVE if required land-cover or geometry data is unavailable.",
    ],
    limitations: [
      "This is a planning-level counterfactual, not field validation.",
      "Historical restoration actions are inspired by reconstructed landscape capacity and do not recreate guaranteed historical hydrology.",
      "Hydrology overlays remain bounded by the current Mannahatta D8 simulation and available elevation data.",
    ],
    requiredData: [
      "Active analysis land-cover percentages",
      "Current absorption score",
      "Scenario intervention type and fraction",
    ],
    verification: { warnings: [] },
    ...fields,
  });
}

function scenarioFor(
  intervention: CatalystIntervention,
  fraction: number
): Scenario {
  return {
    ...EMPTY_SCENARIO,
    [CATALYST_TO_SCENARIO[intervention]]: fraction,
  };
}

function solveMinimumFraction(
  cover: LandCover,
  intervention: CatalystIntervention,
  targetScore: number
) {
  const current = projectScore(cover, EMPTY_SCENARIO);
  const maxScore = projectScore(cover, scenarioFor(intervention, 1));
  if (targetScore <= current) {
    return { possible: true, fraction: 0, score: current, current, maxScore };
  }
  if (targetScore > maxScore) {
    return { possible: false, fraction: 1, score: maxScore, current, maxScore };
  }

  const key = CATALYST_TO_SCENARIO[intervention];
  const def = INTERVENTIONS[key];
  const land =
    cover.vegetation + cover.soil + cover.buildings + cover.pavement || 1;
  const sourceShare = cover[def.source] / land;
  const sourceWeight =
    def.source === "vegetation"
      ? 0.8
      : def.source === "soil"
      ? 0.7
      : def.source === "buildings"
      ? 0.1
      : 0.12;
  const scoreGainAtFullConversion =
    sourceShare * (def.targetWeight - sourceWeight) * 100;
  const rawFraction =
    scoreGainAtFullConversion > 0
      ? (targetScore - current) / scoreGainAtFullConversion
      : 1;
  const fraction =
    Math.round(Math.min(1, Math.max(0, rawFraction)) * 10_000) / 10_000;
  return {
    possible: true,
    fraction,
    score: projectScore(cover, scenarioFor(intervention, fraction)),
    current,
    maxScore,
  };
}

function comparisonVariants(
  cover: LandCover,
  context: CatalystSiteContext,
  fraction: number
): ScenarioVariant[] {
  const areaM2 = contextAreaM2(context);
  return INTERVENTION_ORDER.map((key) => {
    const scenario = { ...EMPTY_SCENARIO, [key]: fraction };
    const impact = assessScenario(cover, scenario, areaM2);
    return {
      id: key,
      label: INTERVENTIONS[key].label,
      intervention: SCENARIO_TO_CATALYST[key],
      fraction,
      projectedScore: impact.projectedScore,
      addedRetentionM3: impact.addedRetentionM3,
      cost: impact.capexUSD,
    };
  });
}

export class LocalCatalystProvider implements CatalystProvider {
  async compileExperiment(
    context: CatalystSiteContext,
    request: CatalystRequest
  ): Promise<CatalystExperiment> {
    const cover = contextCover(context);

    if (request.kind === "minimum-intervention") {
      const target = Math.min(100, Math.max(0, request.targetScore));
      const solved = solveMinimumFraction(cover, request.intervention, target);
      const action: CatalystAction = solved.possible
        ? {
            type: "scenario",
            intervention: request.intervention,
            fraction: solved.fraction,
          }
        : {
            type: "custom",
            executable: false,
            description: `${catalystLabel(
              request.intervention
            )} cannot reach score ${target.toFixed(
              1
            )} under the current Scenario Studio model. Maximum modeled score is ${solved.maxScore.toFixed(
              1
            )}.`,
          };

      return experimentBase(context, {
        hypothesis: `The smallest ${catalystLabel(
          request.intervention
        ).toLowerCase()} intervention that reaches score ${target.toFixed(
          0
        )} can be found from the current land-cover mix.`,
        objective: `Move the site from ${solved.current.toFixed(
          1
        )} to at least ${target.toFixed(1)} without exceeding the minimum modeled conversion fraction.`,
        scientificStatus: "experimental",
        actions: [action],
        executionStatus: solved.possible ? "executable" : "partially-executable",
        successCriteria: [
          `SUPPORTED UNDER THIS SIMULATION if projected absorption score is at least ${target.toFixed(
            1
          )}.`,
        ],
        falsificationCriteria: [
          `NOT SUPPORTED UNDER THIS SIMULATION if projected absorption score remains below ${target.toFixed(
            1
          )}.`,
        ],
        verification: {
          score: solved.score,
          warnings: solved.possible
            ? []
            : [
                `Selected intervention cannot reach ${target.toFixed(
                  1
                )}; maximum modeled score is ${solved.maxScore.toFixed(1)}.`,
              ],
        },
      });
    }

    if (request.kind === "compare-interventions") {
      const fraction = Math.min(1, Math.max(0, request.fraction));
      const variants = comparisonVariants(cover, context, fraction);
      return experimentBase(context, {
        hypothesis: `Equal-area green infrastructure strategies will produce different modeled absorption gains on this terrain.`,
        objective: `Compare supported interventions at ${Math.round(
          fraction * 100
        )}% conversion of their source classes.`,
        scientificStatus: "experimental",
        actions: [{ type: "comparison", variants }],
        executionStatus: "executable",
        methodology: [
          "Run each supported Scenario Studio intervention at the same fraction.",
          "Rank by projected score and planning-level retention where area is available.",
        ],
        successCriteria: [
          "SUPPORTED UNDER THIS SIMULATION when at least one modeled variant improves the current score.",
        ],
        verification: {
          score: Math.max(...variants.map((variant) => variant.projectedScore ?? 0)),
          warnings: [],
        },
      });
    }

    if (request.kind === "storm-stress-test") {
      const rainfallMm = Math.min(500, Math.max(1, request.rainfallMm));
      return experimentBase(context, {
        hypothesis: `A ${rainfallMm} mm design storm will expose where current and future surfaces route water differently.`,
        objective: "Run Mannahatta's hydrology engine for the active map footprint.",
        scientificStatus: "established",
        actions: [{ type: "hydrology", rainfallMm, resolution: "medium" }],
        executionStatus: "executable",
        requiredData: ["Active map bbox", "Rainfall depth", "Elevation data or fallback slope model"],
      });
    }

    if (request.kind === "restore-lost-system") {
      const fraction = Math.min(1, Math.max(0, request.fraction));
      return experimentBase(context, {
        hypothesis:
          "A counterfactual intervention inspired by the reconstructed historical landscape may improve modeled absorption.",
        objective: `Restore ${Math.round(
          fraction * 100
        )}% of the analyzed footprint as a wetland/vegetation proxy where geometry is available.`,
        scientificStatus: "speculative",
        actions: [{ type: "scenario", intervention: "bioswale", fraction }],
        executionStatus: "partially-executable",
        limitations: [
          "No detailed block-level 1609 geometry is available in this repository.",
          "This models a present-day intervention inspired by historical landscape capacity, not guaranteed historical hydrological behavior.",
        ],
        verification: {
          score: projectScore(cover, scenarioFromCatalystAction({
            type: "scenario",
            intervention: "bioswale",
            fraction,
          })),
          warnings: ["Historical geometry is approximated for this location."],
        },
      });
    }

    return experimentBase(context, {
      hypothesis: request.text.trim() || "Custom counterfactual hypothesis",
      objective: "Compile the custom text into a research plan and mark unsupported pieces clearly.",
      scientificStatus: "speculative",
      actions: [
        {
          type: "custom",
          executable: false,
          description:
            "This custom hypothesis needs review before it can be converted into supported Mannahatta scenario or hydrology actions.",
        },
      ],
      executionStatus: "draft",
      verification: {
        warnings: ["PROPOSED - NOT CURRENTLY EXECUTABLE until mapped to supported Catalyst actions."],
      },
      requiredData: [
        "A supported intervention type",
        "A bounded conversion fraction",
        "Optional rainfall depth for hydrology",
      ],
    });
  }
}

export { FIXED_LOCAL_ID as LOCAL_CATALYST_PREVIEW_ID };

