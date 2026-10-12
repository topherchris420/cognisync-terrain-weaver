import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReplayReadout } from "./ReplayReadout";
import { buildExperimentExport } from "@/lib/experiment-export";
import { importExperiment } from "@/lib/experiment-import";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import { createStormSeal } from "@/lib/storm-identity";
import { stableHash } from "@/lib/counterfactual/hashing";
import { routeWatershed, syntheticElevation } from "@/lib/hydrology";

const bbox = { west: -74.014, east: -74.004, south: 40.703, north: 40.712 };
const forcing = { rainfallDepthMm: 50, durationMinutes: 60, distribution: "uniform" as const, resolution: "low" as const, includeDrainage: false as const };
const storm = createStormSeal({ ...forcing, id: "readout-storm", hash: stableHash(forcing) }, "2026-10-12T00:00:00.000Z");
const elevation = syntheticElevation(bbox, 36, 36);
const now = routeWatershed({ ...forcing, bbox, landCover: EXAMPLE_ANALYSIS.land_cover, stormHash: storm.storm.hash, elevation, surfaceId: "now", surfaceHash: "surface:now" });
const text = () => JSON.stringify(buildExperimentExport({ analysis: EXAMPLE_ANALYSIS, scenario: EMPTY_SCENARIO, interventions: [], storm, now, possible: null, extent: bbox, elevation }));

describe("ReplayReadout", () => {
  it("says every check held and lists them", async () => {
    const study = await importExperiment(text());
    render(<ReplayReadout study={study} />);
    expect(screen.getByRole("heading", { name: /Reproduced: every input verified and every output matched/ })).toBeInTheDocument();
    expect(screen.getByText(/mannahatta-experiment-v4 · evidence fnv1a64:/)).toBeInTheDocument();
    const checks = screen.getByLabelText("Replay checks");
    expect(checks.querySelectorAll("li").length).toBe(study.report.checks.length);
    expect(checks.querySelectorAll("li[data-failed]")).toHaveLength(0);
    expect(screen.getByText(/recomputed by this build from the file's inputs/)).toBeInTheDocument();
  });

  it("names the failed checks and the dropped storm when the seal does not verify", async () => {
    const edited = JSON.parse(text());
    edited.storm.storm.rainfallDepthMm = 75;
    const study = await importExperiment(JSON.stringify(edited));
    render(<ReplayReadout study={study} />);
    expect(screen.getByRole("heading", { name: /checks did not hold/ })).toBeInTheDocument();
    expect(screen.getByText(/storm seal did not verify, so no routed result was loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Replay checks").querySelectorAll("li[data-failed]").length).toBeGreaterThan(0);
  });

  it("has a one-line form for other tabs", async () => {
    const study = await importExperiment(text());
    render(<ReplayReadout study={study} compact />);
    expect(screen.getByRole("status")).toHaveTextContent(/Reopened evidence\. Reproduced/);
  });
});
