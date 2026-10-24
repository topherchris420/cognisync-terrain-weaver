import { ArrowRight } from "lucide-react";

export type StudyTab = "overview" | "simulation" | "mitigation" | "compare" | "export";

interface StudyGuideProps {
  tab: StudyTab;
  hasStorm: boolean;
  hasDrawings: boolean;
  hasComparison: boolean;
  busy: boolean;
  onNavigate: (tab: StudyTab) => void;
}

/** Navigation help follows the actual study, including tabs visited out of order. */
export function StudyGuide({ tab, hasStorm, hasDrawings, hasComparison, busy, onNavigate }: StudyGuideProps) {
  let title: string;
  let description: string;
  let action: { label: string; tab: StudyTab } | undefined;

  switch (tab) {
    case "overview":
      title = "Start with the ground";
      description = "Review the estimated surfaces below, then choose rainfall to see where the water goes.";
      action = { label: "Choose a storm", tab: "simulation" };
      break;
    case "simulation":
      title = hasStorm ? "Your baseline storm is ready" : "Choose the rain to test";
      description = hasStorm
        ? "This storm stays fixed so you can test how a different design changes the runoff."
        : "Adjust rainfall and grid detail below, then route the storm. You can use the default 50 mm to get started.";
      if (hasStorm) action = { label: "Plan a redesign", tab: "mitigation" };
      break;
    case "mitigation":
      title = !hasStorm ? "First, establish the baseline" : hasComparison ? "Your redesign has been tested" : "Give the water a different path";
      description = !hasStorm
        ? "Run a storm on today's ground before testing changes against the same rainfall."
        : hasComparison
          ? "Compare the two results, or keep drawing to explore another design. Editing clears the previous comparison."
          : hasDrawings
            ? "Your drawings are ready. Use the rerun control below to test them against the baseline storm."
            : "Choose a drawing tool below, place points on the map, and close the shape to add an intervention.";
      if (!hasStorm) action = { label: "Choose a storm", tab: "simulation" };
      else if (hasComparison) action = { label: "Review comparison", tab: "compare" };
      break;
    case "compare":
      title = hasComparison ? "See what your changes did" : "Build a comparison";
      description = hasComparison
        ? "Review runoff and cost under the same storm, then export a copy of your study."
        : !hasStorm
          ? "Start by routing a storm on the current ground. Then draw changes and rerun that same storm."
          : !hasDrawings
            ? "The baseline is ready. Add a drawing in Mitigation, then rerun the storm to compare results."
            : "Your drawings are ready. Return to Mitigation and rerun the same storm to complete the comparison.";
      action = hasComparison
        ? { label: "Save or export", tab: "export" }
        : !hasStorm
          ? { label: "Choose a storm", tab: "simulation" }
          : { label: hasDrawings ? "Return to redesign" : "Draw interventions", tab: "mitigation" };
      break;
    case "export":
      title = "Keep a study you can reopen";
      description = "Choose experiment JSON to reopen your work here. Choose PDF for a readable report. A shared map link contains only the map view.";
      break;
  }

  return (
    <section className="atlas-guide" aria-label="Study guidance">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button type="button" disabled={busy} onClick={() => onNavigate(action.tab)}>
          {action.label} <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
