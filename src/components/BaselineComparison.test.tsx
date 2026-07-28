import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaselineComparison } from "@/components/BaselineComparison";
import { BASELINE_SCORE } from "@/lib/baseline";

describe("BaselineComparison", () => {
  it("names both ends of the scale so the number has a reference", () => {
    render(<BaselineComparison score={58} />);
    expect(screen.getByText("Fully paved")).toBeInTheDocument();
    expect(screen.getByText("Mannahatta, 1609")).toBeInTheDocument();
  });

  it("reports retained capacity against the baseline", () => {
    render(<BaselineComparison score={14} />);
    const retained = Math.round((14 / BASELINE_SCORE) * 100);
    expect(screen.getByText(`${retained}%`)).toBeInTheDocument();
  });

  it("says the baseline is intact for a site that meets it", () => {
    render(<BaselineComparison score={95} />);
    expect(screen.getByText(/baseline is intact/)).toBeInTheDocument();
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
      screen.getByText(/not a figure published by the Mannahatta Project/)
    ).toBeInTheDocument();
  });

  it("drops the provenance note in compact mode", () => {
    render(<BaselineComparison score={58} compact />);
    expect(
      screen.queryByText(/not a figure published by the Mannahatta Project/)
    ).not.toBeInTheDocument();
    // The scale itself still renders.
    expect(screen.getByText("Mannahatta, 1609")).toBeInTheDocument();
  });
});
