import { useId, useMemo, useState } from "react";
import { ABSORPTION_WEIGHTS } from "@/lib/absorption";
import { assumption } from "@/lib/assumptions/registry";
import { solveForTarget } from "@/lib/catalyst";
import { classificationEnvelope, scenarioAreas, scenarioForAreas } from "@/lib/classification-envelope";
import { CLASSIFICATION_ERROR } from "@/lib/evidence/ledger";
import { INTERVENTIONS, formatCompactUSD, projectScore, siteCoverShares, type InterventionKey } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";
import { judgeHypothesis, MODEL_VERDICT_LABEL } from "@/lib/validation/hypothesis";

const BASIS_LABEL = {
  "published-range": "published range",
  derived: "derived",
  "scenario-assumption": "scenario assumption, unsourced",
} as const;

/** Every link from classified surface to cost, with the evidence behind each. */
function AssumptionChain({ keyName, fraction, cover, areaM2 }: { keyName: InterventionKey; fraction: number; cover: LandCover; areaM2: number }) {
  const def = INTERVENTIONS[keyName];
  const share = siteCoverShares(cover)[def.source];
  const available = areaM2 * share;
  const converted = available * fraction;
  const from = ABSORPTION_WEIGHTS[def.source];
  const lift = def.targetWeight - from;
  const retention = assumption(`intervention.${keyName}.retention`);
  const cost = assumption(`cost.${keyName}`);
  const landShare = 1 - siteCoverShares(cover).water;
  const rows: Array<[string, string]> = [
    ["Source surface", `${def.source}: ${(share * 100).toFixed(0)}% of the site, ${Math.round(available).toLocaleString()} m² (inferred cover)`],
    ["Eligibility", "Aggregate upper bound: all classified source surface assumed available; not mapped"],
    ["Area converted", `${Math.round(converted).toLocaleString()} m² (${(fraction * 100).toFixed(1)}% of the source)`],
    ["Retention", `${from.toFixed(2)} → ${def.targetWeight.toFixed(2)} (${BASIS_LABEL[retention.basis]})`],
    ["Unit cost", `$${cost.value}/m² (${BASIS_LABEL[cost.basis]})`],
    ["Modeled effect", `+${landShare > 0 ? ((share / landShare) * fraction * lift * 100).toFixed(1) : "0"} score points; ${Math.round(converted * lift * 0.05).toLocaleString()} m³ less runoff at 50 mm`],
    ["Cost", formatCompactUSD(converted * def.unitCostUSD)],
    ["Limitation", retention.limitation],
  ];
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">
        {def.label}: {(fraction * 100).toFixed(1)}% of classified {def.source}
      </summary>
      <dl className="atlas-ledger mt-2">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd className="max-w-[65%] whitespace-normal text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Aggregate planning stays separate from canonical drawn spatial interventions. */
export function PlanningEnvelope({
  cover,
  areaM2,
}: {
  cover: LandCover;
  areaM2: number;
}) {
  const id = useId();
  const [target, setTarget] = useState(45);
  const [budget, setBudget] = useState<number | "">(100000);
  const solution = useMemo(
    () =>
      solveForTarget(
        cover,
        target,
        areaM2,
        areaM2 > 0 && budget !== "" ? budget : undefined,
      ),
    [cover, target, areaM2, budget],
  );
  // Does the same built plan still reach the target if the cover estimate is
  // off by the measured classification error (classification/C1)?
  const robustness = useMemo(() => {
    if (!solution.reachable || areaM2 <= 0 || solution.used.length === 0) return null;
    const built = scenarioAreas(cover, solution.scenario, areaM2);
    const envelope = classificationEnvelope(cover, areaM2, 50, {
      pp: CLASSIFICATION_ERROR.benchmarkPP,
      kind: "benchmark-derived",
      label: "",
      source: "classification/C1-nlcd-agreement",
    });
    const achieved = envelope.rows.map((row) => projectScore(row.cover, scenarioForAreas(row.cover, built, areaM2)));
    const verdict = judgeHypothesis(
      { statement: "plan reaches target", metric: "score", comparison: ">=", threshold: target - 0.05 },
      achieved[1],
      { min: Math.min(...achieved), max: Math.max(...achieved) },
    );
    return { verdict, min: Math.min(...achieved), max: Math.max(...achieved) };
  }, [solution, cover, areaM2, target]);
  return (
    <section
      className="atlas-section space-y-4"
      aria-labelledby={`${id}-title`}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-primary">
        Catalyst / what could be
      </p>
      <h3 id={`${id}-title`} className="atlas-section-title">
        What would have to change?
      </h3>
      <p className="atlas-section-note">
        Find the least-cost mix for a target score, or the strongest result the
        budget permits. This aggregate envelope does not establish where
        interventions can be built.
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label htmlFor={`${id}-target`}>
          Target score
          <input
            id={`${id}-target`}
            type="number"
            min="0"
            max="100"
            value={target}
            onChange={(e) =>
              setTarget(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
            }
            className="mt-2 block min-h-11 w-full border border-border bg-background px-3"
          />
        </label>
        <label htmlFor={`${id}-budget`}>
          Installation budget (USD)
          <input
            id={`${id}-budget`}
            type="number"
            min="0"
            placeholder="Unbounded"
            disabled={areaM2 <= 0}
            value={budget}
            onChange={(e) =>
              setBudget(
                e.target.value === ""
                  ? ""
                  : Math.max(0, Number(e.target.value) || 0),
              )
            }
            className="mt-2 block min-h-11 w-full border border-border bg-background px-3"
          />
        </label>
      </div>
      <div role="status" className="border-y border-border py-3 space-y-2">
        <p className="text-sm font-medium">
          {solution.reachable
            ? "Target achievable in this aggregate model"
            : "Not achievable under these assumptions"}
        </p>
        <p className="font-mono text-sm">
          {solution.baseScore.toFixed(1)} NOW →{" "}
          {solution.achievedScore.toFixed(1)} POSSIBLE
        </p>
        <p className="text-xs text-muted-foreground">
          Surface ceiling {solution.ceilingScore.toFixed(1)} · budget ceiling{" "}
          {solution.budgetCeilingScore.toFixed(1)} · remaining gap{" "}
          {solution.remainingGap.toFixed(1)}
        </p>
        <p className="text-xs">
          {solution.costUSD === null
            ? "Cost unavailable without a study area"
            : `${formatCompactUSD(solution.costUSD)} installation estimate`}
          {solution.bindingConstraint !== "none"
            ? ` · binding constraint: ${solution.bindingConstraint}`
            : ""}
        </p>
      </div>
      {robustness && (
        <p className="text-xs" role="note">
          <strong>Survives classification error? </strong>
          {robustness.verdict === "supported-by-model"
            ? "Yes"
            : robustness.verdict === "inconclusive"
              ? "Unclear"
              : "No"}
          {` — with cover off by ±${CLASSIFICATION_ERROR.benchmarkPP} pp (measured against NLCD), the same plan reaches ${robustness.min.toFixed(1)}–${robustness.max.toFixed(1)} against a target of ${target}. ${MODEL_VERDICT_LABEL[robustness.verdict]}.`}
        </p>
      )}
      <div className="space-y-2">
        {solution.used.map((key) => (
          <AssumptionChain key={key} keyName={key} fraction={solution.scenario[key]} cover={cover} areaM2={areaM2} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        All classified roofs and pavement form a theoretical upper bound; mapped
        eligibility, structure, ownership and utilities can lower it. This
        proposal does not place drawings or certify a routed result. Draw
        eligible interventions below to test the same storm.
      </p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Cost assumptions</summary>
        <p className="mt-2">
          Default USD per m²: trees 45, bioswales 65, permeable pavement 150,
          green roofs 180. Planning assumptions, not project quotes. Source
          year, local geography and inflation basis are not documented;
          maintenance, replacement, land acquisition and permitting are
          excluded. The least-cost ranking is conditional on these rates.
        </p>
      </details>
    </section>
  );
}
