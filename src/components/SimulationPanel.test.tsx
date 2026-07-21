import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimulationPanel } from "@/components/SimulationPanel";
import type { BBox } from "@/lib/geo";
import type { LandCover } from "@/lib/types";
import type { SimulationResponse } from "@/lib/simulation-types";

const COVER: LandCover = {
  pavement: 50,
  buildings: 20,
  vegetation: 20,
  water: 0,
  soil: 10,
};

const BBOX: BBox = [
  [-74.0, 40.75],
  [-73.99, 40.76],
];

const RESULT: SimulationResponse = {
  flow_paths: [
    { points: [[40.75, -74], [40.76, -73.99]], volume_m3: 500, velocity_mps: 1.2 },
  ],
  risk_zones: [
    { polygon: [[40.75, -74], [40.76, -74]], level: "high", affected_area_km2: 0.01 },
    { polygon: [[40.75, -73.99], [40.76, -73.99]], level: "severe", affected_area_km2: 0.01 },
  ],
  impact_points: [],
  metadata: {
    processed_area_km2: 0.83,
    cells_analyzed: 8100,
    computation_time_ms: 142,
  },
};

describe("SimulationPanel", () => {
  it("runs the simulation with the selected rainfall (default 50mm)", () => {
    const onRun = vi.fn();
    render(
      <SimulationPanel landCover={COVER} bbox={BBOX} onRunSimulation={onRun} />
    );
    fireEvent.click(screen.getByRole("button", { name: /run full simulation/i }));
    expect(onRun).toHaveBeenCalledWith({
      rainfall_mm: 50,
      resolution: "medium",
      include_drainage: true,
    });
  });

  it("shows an instant runoff estimate when a bbox is available", () => {
    render(
      <SimulationPanel landCover={COVER} bbox={BBOX} onRunSimulation={vi.fn()} />
    );
    expect(screen.getByText(/quick estimate/i)).toBeInTheDocument();
  });

  it("omits the estimate when no bbox is available", () => {
    render(
      <SimulationPanel landCover={COVER} bbox={null} onRunSimulation={vi.fn()} />
    );
    expect(screen.queryByText(/quick estimate/i)).not.toBeInTheDocument();
  });

  it("disables the run button and shows the reason when the area is too large", () => {
    const onRun = vi.fn();
    render(
      <SimulationPanel
        landCover={COVER}
        bbox={BBOX}
        onRunSimulation={onRun}
        disabledReason="This view is 73 km² — zoom in to under 50 km²."
      />
    );
    const button = screen.getByRole("button", { name: /run full simulation/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/zoom in to under 50/i)).toBeInTheDocument();
    fireEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("renders result counts once a simulation returns", () => {
    render(
      <SimulationPanel
        landCover={COVER}
        bbox={BBOX}
        onRunSimulation={vi.fn()}
        simulationResult={RESULT}
      />
    );
    expect(screen.getByText("Results")).toBeInTheDocument();
    // 2 risk zones, 1 flow path
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0.83 km²")).toBeInTheDocument();
    expect(screen.getByText(/142 ms/)).toBeInTheDocument();
  });

  it("shows a spinner and disables the button while loading", () => {
    render(
      <SimulationPanel
        landCover={COVER}
        bbox={BBOX}
        onRunSimulation={vi.fn()}
        isLoading
      />
    );
    const button = screen.getByRole("button", { name: /simulating/i });
    expect(button).toBeDisabled();
  });
});
