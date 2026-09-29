import { useId } from "react";
import { EVIDENCE_LEDGER, type Question } from "@/lib/evidence/ledger";
import { EVIDENCE_META, VALIDATION_META } from "@/lib/evidence/status";

const QUESTIONS: Question[] = ["What was?", "What is?", "What could be?"];
const REPORTS = "https://github.com/topherchris420/cognisync-terrain-weaver/blob/main/experiments";

/**
 * The fourth question, beneath the other three: for each part of the
 * instrument, what kind of number it produces and how far it has been
 * tested. Generated from committed experiment findings, never hand-written.
 */
export function HowDoWeKnow({ className = "atlas-section" }: { className?: string }) {
  const id = useId();
  return (
    <section className={className} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="atlas-section-title">How do we know?</h3>
      <p className="atlas-section-note">
        What each number is, and how far it has been tested against the world. Passing software
        tests means the code does what it says, not that nature agrees.
      </p>
      {QUESTIONS.map((question) => (
        <div key={question} className="atlas-know-group">
          <p className="atlas-know-question">{question}</p>
          <ul className="atlas-know-list">
            {EVIDENCE_LEDGER.filter((entry) => entry.question === question).map((entry) => (
              <li key={entry.id} data-validation={entry.validation}>
                <details>
                  <summary>
                    <span className="atlas-know-component">{entry.component}</span>
                    <span className="atlas-know-tags">
                      <span title={EVIDENCE_META[entry.evidence].means}>{EVIDENCE_META[entry.evidence].label}</span>
                      <span className="atlas-know-validation" title={VALIDATION_META[entry.validation].means}>
                        {VALIDATION_META[entry.validation].label}
                      </span>
                    </span>
                  </summary>
                  <p>{entry.finding}</p>
                  {entry.experiments.length > 0 && (
                    <p className="atlas-know-links">
                      {entry.experiments.map((experiment) => (
                        <a key={experiment} href={`${REPORTS}/${experiment}/REPORT.md`} target="_blank" rel="noreferrer">
                          {experiment.split("/")[1]}
                        </a>
                      ))}
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
