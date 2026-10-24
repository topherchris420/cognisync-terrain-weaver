import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisLaunchPanel } from "./AnalysisLaunchPanel";

describe("AnalysisLaunchPanel", () => {
  it("explains a failed map without leaving an endless loading indicator", () => {
    render(<AnalysisLaunchPanel location="Manhattan" areaKm2={0} mapReady={false} mapUnavailable onAnalyze={vi.fn()} onExample={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Live map unavailable" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/example and saved experiment files are still available/i);
    expect(screen.getByRole("button", { name: /explore an example/i })).toBeEnabled();
  });
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
    fireEvent.click(screen.getByRole("button", { name: /scan this area/i }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it("prevents launch while imagery is still loading", () => {
    render(
      <AnalysisLaunchPanel location="Target" areaKm2={1} mapReady={false} onAnalyze={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /acquiring satellite feed/i })).toBeDisabled();
  });

  it("hands a chosen experiment file to the workstation and clears the picker", () => {
    const onOpenFile = vi.fn();
    render(<AnalysisLaunchPanel location="Manhattan" areaKm2={0} mapReady={false} onAnalyze={vi.fn()} onOpenFile={onOpenFile} />);
    const input = screen.getByLabelText(/open an experiment file/i) as HTMLInputElement;
    expect(input).toHaveAttribute("accept", ".json,application/json");
    const file = new File(["{}"], "study.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onOpenFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
    expect(screen.getByText(/verified and replayed here before anything is shown/i)).toBeInTheDocument();
  });

  it("lets visitors open an explicitly labeled example while imagery is unavailable", () => {
    const onExample = vi.fn();
    render(<AnalysisLaunchPanel location="Manhattan" areaKm2={0} mapReady={false} onAnalyze={vi.fn()} onExample={onExample} />);
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    expect(onExample).toHaveBeenCalledOnce();
    expect(screen.getByText(/illustrative data/i)).toBeInTheDocument();
  });
});
