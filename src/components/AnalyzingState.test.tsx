import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyzingState } from "@/components/AnalyzingState";

const TILE = "data:image/jpeg;base64,abc123";

describe("AnalyzingState", () => {
  it("names every pipeline stage so the wait reads as real work", () => {
    render(<AnalyzingState tile={TILE} />);
    expect(screen.getByText("Capturing satellite tile")).toBeInTheDocument();
    expect(screen.getByText("Classifying land cover")).toBeInTheDocument();
    expect(screen.getByText("Computing absorption score")).toBeInTheDocument();
    expect(
      screen.getByText("Drafting adaptation strategies")
    ).toBeInTheDocument();
  });

  it("shows the exact tile being classified when one was captured", () => {
    render(<AnalyzingState tile={TILE} />);
    const img = screen.getByAltText<HTMLImageElement>(
      "Satellite tile under analysis"
    );
    expect(img).toBeInTheDocument();
    expect(img.src).toContain(TILE);
  });

  it("renders a placeholder, not a broken image, before the tile is ready", () => {
    const { container } = render(<AnalyzingState tile={null} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
