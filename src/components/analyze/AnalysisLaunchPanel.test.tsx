import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisLaunchPanel } from "./AnalysisLaunchPanel";

describe("AnalysisLaunchPanel", () => {
  it("summarizes the footprint and launches a ready analysis", () => {
    const onAnalyze = vi.fn();
    render(
      <AnalysisLaunchPanel
        location="Lower Manhattan"
        areaKm2={0.846}
        mapReady
        onAnalyze={onAnalyze}
      />
    );

    expect(screen.getByText("Lower Manhattan")).toBeInTheDocument();
    expect(screen.getByText("0.85")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /initialize terrain scan/i }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it("prevents launch while imagery is still loading", () => {
    render(
      <AnalysisLaunchPanel location="Target" areaKm2={1} mapReady={false} onAnalyze={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /acquiring satellite feed/i })).toBeDisabled();
  });

  it("lets visitors open an explicitly labeled example while imagery is unavailable", () => {
    const onExample = vi.fn();
    render(<AnalysisLaunchPanel location="Manhattan" areaKm2={0} mapReady={false} onAnalyze={vi.fn()} onExample={onExample} />);
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    expect(onExample).toHaveBeenCalledOnce();
    expect(screen.getByText(/illustrative data/i)).toBeInTheDocument();
  });
});
