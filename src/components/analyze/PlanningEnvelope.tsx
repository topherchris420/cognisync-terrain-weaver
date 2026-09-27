import { useId, useMemo, useState } from "react";
import { solveForTarget } from "@/lib/catalyst";
import { INTERVENTIONS, formatCompactUSD } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";

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
      <ul className="space-y-2 text-xs">
        {solution.used.map((key) => (
          <li key={key}>
            {INTERVENTIONS[key].label}:{" "}
            {(solution.scenario[key] * 100).toFixed(1)}% of classified{" "}
            {INTERVENTIONS[key].source}
          </li>
        ))}
      </ul>
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
