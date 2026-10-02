import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UrbanSubstratePanel } from "./UrbanSubstratePanel";
import { compileSubstrate } from "@/lib/urban-substrate/compiler";
import { serializeManifest } from "@/lib/urban-substrate/manifest";
import { loadSubstrateView, memoryStore } from "@/lib/urban-substrate/loader";
import { coverageBBox } from "@/lib/urban-substrate/regions";
import { TEST_CONFIG, testSources } from "@/lib/urban-substrate/test-fixtures";
import { unavailable } from "@/lib/urban-substrate/identity";

async function readyView() {
  const compiled = compileSubstrate(testSources(), TEST_CONFIG, { generatedAt: "2026-10-01T00:00:00.000Z", commit: null });
  const [w, s] = coverageBBox(TEST_CONFIG);
  return loadSubstrateView(memoryStore({ texts: compiled.texts, manifestText: serializeManifest(compiled.manifest) }), { west: w + 0.001, south: s + 0.001, east: w + 0.01, north: s + 0.008 });
}

describe("Urban substrate panel", () => {
  it("shows identity, provenance and evidence status without flooding the panel", async () => {
    const view = await readyView();
    render(<UrbanSubstratePanel status={{ phase: "ready", view, state: view.identity }} />);
    expect(screen.getByText("Urban substrate")).toBeInTheDocument();
    expect(screen.getByText(/test-synthetic · \d+ local \+ \d+ context tiles/)).toBeInTheDocument();
    const identity = screen.getByLabelText("Substrate identity");
    expect(identity).toHaveTextContent(/Version.*test-synthetic/);
    expect(identity).toHaveTextContent(/Manifest.*sha256:/);
    expect(screen.getByLabelText("Substrate facts for the study extent")).toHaveTextContent(/Building footprints \(measured\)/);
    expect(screen.getByText(/does not read this geometry yet, and nothing here changes the AI land cover/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Source datasets/));
    expect(screen.getByText("Synthetic nyc-building-footprints")).toBeInTheDocument();
    expect(screen.getByText(/Surface-flow structure \(experimental\)/)).toBeInTheDocument();
  });

  it("says plainly when a place has no substrate", () => {
    render(<UrbanSubstratePanel status={{ phase: "unavailable", state: unavailable("outside-coverage", "x") }} />);
    expect(screen.getByText("No compiled substrate covers this place yet.")).toBeInTheDocument();
    expect(screen.getByText(/record this state \(outside-coverage\)/)).toBeInTheDocument();
  });
});
