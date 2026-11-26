import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  step: number;
  label: string;
  hint: string;
  busy: boolean;
  disabled?: boolean;
  onAction: () => void;
}

/** Stays outside the scrolling reading pane so the next action is always reachable. */
export function StudyActionBar({ step, label, hint, busy, disabled, onAction }: Props) {
  return (
    <footer role="group" className="atlas-action-bar" aria-label="Next study step">
      <p id="study-action-hint"><span>Step {step} of 5</span>{hint}</p>
      <Button type="button" className="atlas-primary min-h-11 w-full justify-between gap-3 text-sm" disabled={disabled || busy} aria-busy={busy} aria-describedby="study-action-hint" onClick={onAction}>
        {label}
        {busy ? <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" /> : <ArrowRight size={16} className="shrink-0" aria-hidden="true" />}
      </Button>
    </footer>
  );
}
