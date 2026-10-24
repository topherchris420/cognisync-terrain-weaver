import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroundReading, ComparisonReading, StormReading } from "./StudyReading";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import type { SimulationResponse } from "@/lib/simulation-types";

function run(runoff: number, modifier = "base"): SimulationResponse {
  return { flow_paths: [], risk_zones: [], impact_points: [], metadata: {
    processed_area_km2: 1, cells_analyzed: 100, computation_time_ms: 1,
    runoff_volume_m3: runoff, storm_hash: "storm", rainfall_mm: 50,
    duration_min: 60, extent_hash: "extent", land_cover_hash: "cover",
    elevation_hash: "elevation", elevation_status: "illustrative",
    model: "routing", substrate_hash: "substrate:none", modifier_hash: modifier,
  } };
}

describe("study readings", () => {
  it("shows a storm result with its evidence basis and handles a missing rainfall total", () => {
    const baseline = run(75);
    baseline.metadata.rainfall_volume_m3 = 100;
    const view = render(<StormReading result={baseline} illustrativeCover />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText(/illustrative terrain/i)).toBeInTheDocument();
    delete baseline.metadata.rainfall_volume_m3;
    view.rerender(<StormReading result={baseline} illustrativeCover />);
    expect(screen.getByText(/total is missing/i)).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });
  it("labels example surface shares and their limit without implying measured flood risk", () => {
    render(<GroundReading analysis={EXAMPLE_ANALYSIS} />);
    expect(screen.getByText("67")).toBeInTheDocument();
    expect(screen.getByText(/illustrative example inputs/i)).toBeInTheDocument();
    expect(screen.getByText(/site flood risk has not been established/i)).toBeInTheDocument();
  });

  it.each([[100, 75, "Less runoff"], [100, 120, "More runoff"], [100, 100, "No modeled runoff reduction"]])("reports runoff direction for %s → %s", (before, after, title) => {
    render(<ComparisonReading now={run(Number(before))} possible={run(Number(after), "drawn")} illustrativeCover costUSD={10000} />);
    expect(screen.getByRole("heading", { name: new RegExp(String(title)) })).toBeInTheDocument();
    expect(screen.getByText(/illustrative terrain/i)).toBeInTheDocument();
  });

  it("withholds the effect headline when the storm changed", () => {
    const changed = run(50, "drawn");
    changed.metadata.storm_hash = "another storm";
    render(<ComparisonReading now={run(100)} possible={changed} illustrativeCover={false} costUSD={10000} />);
    expect(screen.queryByText(/Less runoff in this model/i)).not.toBeInTheDocument();
    expect(screen.getByText(/effect cannot be isolated/i)).toBeInTheDocument();
  });

  it("does not round a small effect to zero or invent a percentage for a zero baseline", () => {
    const view = render(<ComparisonReading now={run(10000)} possible={run(9999, "drawn")} illustrativeCover costUSD={10000} />);
    expect(screen.getByText("<0.1% reduction")).toBeInTheDocument();
    view.rerender(<ComparisonReading now={run(0)} possible={run(1, "drawn")} illustrativeCover costUSD={10000} />);
    expect(screen.queryByText(/% increase/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /more runoff/i })).toBeInTheDocument();
  });

  it("withholds a numerical effect for invalid runoff values", () => {
    render(<ComparisonReading now={run(NaN)} possible={run(50, "drawn")} illustrativeCover={false} costUSD={10000} />);
    expect(screen.getByText(/volume is missing or invalid/i)).toBeInTheDocument();
  });
});
