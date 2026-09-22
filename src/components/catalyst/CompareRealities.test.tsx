import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompareRealities } from "./CompareRealities";
import type { SimulationResponse } from "@/lib/simulation-types";

vi.mock("@/components/MapView", () => ({ MapView: () => <div data-testid="future-map" /> }));
vi.mock("@/components/FlowLayer", () => ({ FlowLayer: () => null }));
vi.mock("@/components/RiskHeatmap", () => ({ RiskHeatmap: () => null }));

const result = (runoff: number): SimulationResponse => ({
  flow_paths: [], risk_zones: [], impact_points: [],
  metadata: { processed_area_km2: 1, cells_analyzed: 100, computation_time_ms: 1, runoff_volume_m3: runoff, elevation_status: "illustrative" },
});
const props = { open: true, onClose: vi.fn(), baseMap: null, currentScore: 25, futureScore: 40, currentRisk: "High", futureRisk: "Moderate" };

describe("comparison workbench", () => {
  it("keeps the existing baseline visible and sizes the wipe to its container", () => {
    render(<CompareRealities {...props} />);
    const root = screen.getByTestId("compare-realities");
    expect(root.className).not.toMatch(/\bbg-background\b/);
    expect(root.innerHTML).not.toContain("100vw");
    expect(screen.getByText("Current surface")).toBeInTheDocument();
    expect(screen.getByText("Proposed surface")).toBeInTheDocument();
  });
  it("supports bounded keyboard navigation and Escape", () => {
    render(<CompareRealities {...props} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "4");
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "96");
    fireEvent.keyDown(slider, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });
  it("reports a computed runoff change and discloses illustrative terrain", () => {
    render(<CompareRealities {...props} baseSimResult={result(1000)} futureSimResult={result(750)} />);
    expect(screen.getByText("25% less runoff")).toBeInTheDocument();
    expect(screen.getByText(/Illustrative terrain/)).toBeInTheDocument();
  });
  it("does not manufacture a percentage for missing or invalid runoff", () => {
    render(<CompareRealities {...props} baseSimResult={result(NaN)} futureSimResult={result(750)} />);
    expect(screen.getByText("Runoff comparison unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("compare-realities").textContent).not.toContain("NaN");
  });
});
