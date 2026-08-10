import {
  Building2,
  Eraser,
  Leaf,
  RotateCcw,
  Sprout,
  Trees,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INTERVENTIONS } from "@/lib/scenario";
import { WETLAND_DISABLED } from "@/lib/counterfactual/eligibility";
import type {
  EligibilityResult,
  InterventionType,
} from "@/lib/counterfactual/types";

interface DirectEditTrayProps {
  activeIntervention: InterventionType | null;
  onSelect: (type: InterventionType | null) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  featureCount: number;
  feedback: EligibilityResult | null;
}

const TOOLS: Array<{
  type: InterventionType;
  label: string;
  icon: typeof Trees;
  disabled?: boolean;
}> = [
  { type: "street_trees", label: "Trees", icon: Trees },
  { type: "bioswales", label: "Bioswale", icon: Sprout },
  {
    type: "permeable_pavement",
    label: "Permeable",
    icon: Waves,
  },
  { type: "green_roofs", label: "Green roof", icon: Building2 },
  { type: "wetland", label: "Wetland", icon: Leaf, disabled: true },
];

export function DirectEditTray({
  activeIntervention,
  onSelect,
  onUndo,
  onClear,
  canUndo,
  featureCount,
  feedback,
}: DirectEditTrayProps) {
  return (
    <section
      aria-label="Redesign the ground"
      className="rounded-2xl border border-white/15 bg-slate-950/88 p-2 text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map(({ type, label, icon: Icon, disabled }) => {
          const selected = activeIntervention === type;
          const definition =
            type === "wetland" ? null : INTERVENTIONS[type];
          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={label}
              title={disabled ? WETLAND_DISABLED : definition?.description}
              className={cn(
                "h-10 gap-2 rounded-xl px-3 text-slate-300 hover:bg-white/10 hover:text-white",
                selected && "bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:text-slate-950"
              )}
              onClick={() => onSelect(selected ? null : type)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          );
        })}
        <span className="mx-1 h-7 w-px bg-white/15" aria-hidden="true" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Undo last ground edit"
          disabled={!canUndo}
          className="h-10 gap-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onUndo}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Clear ${featureCount} ground edits`}
          disabled={featureCount === 0}
          className="h-10 gap-2 rounded-xl text-slate-300 hover:bg-red-500/15 hover:text-red-200"
          onClick={onClear}
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Clear {featureCount}
        </Button>
      </div>

      <p className="sr-only">{WETLAND_DISABLED}</p>
      {feedback && feedback.caveats.length > 0 && (
        <div
          role="status"
          className={cn(
            "mt-2 rounded-xl border px-3 py-2 text-xs",
            feedback.eligible
              ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
              : "border-red-300/25 bg-red-400/10 text-red-100"
          )}
        >
          {feedback.invalidAreaM2 > 0 && (
            <strong className="mr-1">
              Invalid area stays visible and is excluded.
            </strong>
          )}
          {feedback.caveats.join(" ")}
        </div>
      )}
    </section>
  );
}
