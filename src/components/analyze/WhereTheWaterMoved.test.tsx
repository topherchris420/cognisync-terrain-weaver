import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhereTheWaterMoved } from "./WhereTheWaterMoved";
import { spatialDifference } from "@/lib/counterfactual/difference";
import { rasterizeSurfaceModifiers } from "@/lib/counterfactual/modifiers";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { routeWatershed, syntheticElevation } from "@/lib/hydrology";
import { squareIntervention } from "@/lib/validation/fixtures";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const elevation = syntheticElevation(bbox, 36, 36);
const base = { rainfallDepthMm: 50, durationMinutes: 60, resolution: "low" as const, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: "storm:test", elevation };
const now = routeWatershed({ ...base, surfaceId: "now", surfaceHash: "surface:now" });
const possible = routeWatershed({ ...base, surfaceId: "possible", surfaceHash: "surface:possible", modifiers: rasterizeSurfaceModifiers([squareIntervention("bioswales", bbox, 4000)], bbox, 36, 36), expectedElevationHash: now.elevationHash });

describe("WhereTheWaterMoved", () => {
  it("reads the controlled difference in cells, reach and area, with its caveat", () => {
    const onShow = vi.fn();
    render(<WhereTheWaterMoved difference={spatialDifference(now, possible)} shown={true} onShow={onShow} />);
    expect(screen.getByRole("heading", { name: "Where the water moved" })).toBeInTheDocument();
    expect(screen.getByTestId("difference-summary")).toHaveTextContent(/Less water passes through \d+ cells/);
    expect(screen.getByText("Cells carrying less water")).toBeInTheDocument();
    expect(screen.getByText("Under the drawing")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/not where flooding becomes less or more likely/);
    fireEvent.click(screen.getByRole("switch", { name: /show where the water moved/i }));
    expect(onShow).toHaveBeenCalledWith(false);
  });

  it("refuses to draw a difference in forcing", () => {
    const heavier = routeWatershed({ ...base, rainfallDepthMm: 100, surfaceId: "possible", surfaceHash: "surface:possible" });
    render(<WhereTheWaterMoved difference={spatialDifference(now, heavier)} shown={true} onShow={vi.fn()} />);
    expect(screen.getByText(/difference in forcing, not an effect/)).toBeInTheDocument();
    expect(screen.getByText(/Rainfall depth/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders nothing without a pair", () => {
    const { container } = render(<WhereTheWaterMoved difference={null} shown={true} onShow={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
