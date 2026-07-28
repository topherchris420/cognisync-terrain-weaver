import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaselineComparison } from "@/components/BaselineComparison";
import { BASELINE_SCORE } from "@/lib/baseline";

describe("BaselineComparison", () => {
  it("names both ends of the scale so the number has a reference", () => {
    render(<BaselineComparison score={58} />);
    expect(screen.getByText("No absorption")).toBeInTheDocument();
    expect(screen.getByText("Mannahatta, 1609")).toBeInTheDocument();
  });

  // Pavement's weight is 0.12, so a wholly paved tile scores 12, not 0.
  // Labelling zero for a surface would strand a real paved scan to the right
  // of its own reference label.
  it("does not label the zero end with a surface type", () => {
    render(<BaselineComparison score={58} />);
    expect(screen.queryByText(/Fully paved/i)).not.toBeInTheDocument();
  });

  it("reports the site's share of the benchmark", () => {
    render(<BaselineComparison score={14} />);
    const pct = Math.round((14 / BASELINE_SCORE) * 100);
    expect(screen.getByText(`${pct}%`)).toBeInTheDocument();
  });

  it("says a site that meets the benchmark is at it", () => {
    render(<BaselineComparison score={95} />);
    expect(screen.getByText(/at the benchmark/)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("exposes the scale to screen readers as text, not just colour", () => {
    render(<BaselineComparison score={58} />);
    const scale = screen.getByRole("img");
    expect(scale).toHaveAccessibleName(
      expect.stringContaining("Absorption score 58.0 out of 100")
    );
  });

  it("attributes the estimate rather than crediting it to WCS", () => {
    render(<BaselineComparison score={58} />);
    // The provenance note must survive copy edits: overstating the source is
    // the one failure mode that matters here.
    expect(
      screen.getByText(/not a figure published by the\s+Mannahatta Project/)
    ).toBeInTheDocument();
  });

  // A scan of Jakarta gets this same component. It must read as a shared
  // yardstick, not as a reconstruction of that block's own past.
  it("presents the baseline as a fixed reference, not this site's history", () => {
    render(<BaselineComparison score={58} />);
    expect(
      screen.getByText(/fixed reference every site is measured against/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not a reconstruction of what stood on this particular/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Capacity retained/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Absorption lost/i)).not.toBeInTheDocument();
  });

  it("drops the provenance note in compact mode", () => {
    render(<BaselineComparison score={58} compact />);
    expect(
      screen.queryByText(/not a figure published by the\s+Mannahatta Project/)
    ).not.toBeInTheDocument();
    // The scale itself still renders.
    expect(screen.getByText("Mannahatta, 1609")).toBeInTheDocument();
  });
});
