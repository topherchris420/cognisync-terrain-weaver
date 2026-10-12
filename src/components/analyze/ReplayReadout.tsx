import { Check, X } from "lucide-react";
import type { ImportedStudy } from "@/lib/experiment-import";

interface Props {
  study: ImportedStudy;
  /** One line for tabs that are not the overview. */
  compact?: boolean;
}

const short = (hash: string) => (hash.length > 24 ? `${hash.slice(0, 24)}…` : hash);

/**
 * What happened when an exported experiment was reopened: every check that
 * was run, and which ones held. The study on screen is this build's own
 * recomputation of the file's inputs; this panel is where the file's own
 * claims are compared with it.
 */
export function ReplayReadout({ study, compact = false }: Props) {
  const failed = study.report.checks.filter((c) => !c.passed);
  const held = failed.length === 0;
  const state = held ? "reproduced" : "failed";
  const headline = held
    ? study.report.reproduced
      ? "Reproduced: every input verified and every output matched."
      : "Every check held."
    : `${failed.length} of ${study.report.checks.length} checks did not hold.`;
  const stormDropped = Boolean(study.recorded.now) && study.storm === null;

  if (compact) {
    return (
      <p className="atlas-replay atlas-replay--compact" data-state={state} role="status">
        {held ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span><strong>Reopened evidence.</strong> {headline} Details in Overview.</span>
      </p>
    );
  }

  return (
    <section className="atlas-replay mt-4" data-state={state} aria-labelledby="replay-readout-title">
      <p className="atlas-replay-eyebrow">Reopened evidence</p>
      <h3 id="replay-readout-title" className="atlas-replay-status">{headline}</h3>
      {!study.report.sameModel && study.report.rerun && (
        <p className="mt-2 text-xs text-muted-foreground">Replayed with a newer routing model than the file was written with: read any difference as a comparison, not a reproduction.</p>
      )}
      {stormDropped && (
        <p className="mt-2 text-xs text-destructive">The storm seal did not verify, so no routed result was loaded from this file. The land cover and drawings are shown; route a storm to study them.</p>
      )}
      <p className="atlas-replay-meta">
        {study.schema} · evidence {short(study.evidenceHash)}{study.codeCommit ? ` · written by build ${study.codeCommit}` : ""}
      </p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">{study.report.checks.length} checks</summary>
        <ul className="atlas-checks" aria-label="Replay checks">
          {study.report.checks.map((check) => (
            <li key={check.id} data-failed={check.passed ? undefined : true}>
              <span aria-hidden="true">{check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>
              <span>
                <span className="sr-only">{check.passed ? "Passed: " : "Failed: "}</span>
                {check.label}
                <small>{check.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        The score was recomputed from the file's land cover and every routed result shown was recomputed by this build from the file's inputs; the file's own recorded results were only compared with them. Identity hashes are not signatures.
      </p>
    </section>
  );
}
