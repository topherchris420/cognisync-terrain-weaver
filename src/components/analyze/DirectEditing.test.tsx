import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectedMetrics } from "@/lib/counterfactual/projected-metrics";
import { DirectEditTray } from "./DirectEditTray";
import { ScenarioProjectionHUD } from "./ScenarioProjectionHUD";

describe("direct editing controls", () => {
  it("selects spatial tools and keeps unsupported wetlands disabled", () => {
    const onSelect = vi.fn();
    const onUndo = vi.fn();
    const onClear = vi.fn();
    const view = render(
      <DirectEditTray
        activeIntervention={null}
        onSelect={onSelect}
        onUndo={onUndo}
        onClear={onClear}
        canUndo
        featureCount={2}
        feedback={null}
      />
    );

    fireEvent.click(view.getByRole("button", { name: /bioswale/i }));
    expect(onSelect).toHaveBeenCalledWith("bioswales");
    expect(view.getByRole("button", { name: /wetland/i })).toBeDisabled();
    expect(view.getByText(/No defensible wetland suitability/i)).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /undo/i }));
    fireEvent.click(view.getByRole("button", { name: /clear 2/i }));
    expect(onUndo).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });

  it("shows instant cost, absorption, runoff, risk, and estimate status", () => {
    const metrics: ProjectedMetrics = {
      status: "estimated until storm rerun",
      scenarioImpact: {
        baseScore: 30,
        projectedScore: 48,
        scoreDelta: 18,
        baseRisk: "high",
        projectedRisk: "moderate",
        convertedAreaM2: {
          street_trees: 0,
          bioswales: 100,
          permeable_pavement: 0,
          green_roofs: 0,
        },
        totalConvertedAreaM2: 100,
        addedRetentionM3: 50,
        capexUSD: 6500,
        annualBenefitUSD: 125,
        paybackYears: 52,
      },
      estimatedRunoffM3: 260,
      estimatedRisk: "moderate",
      surfaceHash: "surface:test",
      warnings: ["Storage depth remains zero."],
    };
    const view = render(<ScenarioProjectionHUD metrics={metrics} />);

    expect(view.getByText(/estimated until storm rerun/i)).toBeInTheDocument();
    expect(view.getByText("$6,500")).toBeInTheDocument();
    expect(view.getByText("48")).toBeInTheDocument();
    expect(view.getByText(/260 m/i)).toBeInTheDocument();
    expect(view.getByText(/moderate/i)).toBeInTheDocument();
  });
});
