import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScenarioStudio } from "./ScenarioStudio";
import { EMPTY_SCENARIO } from "@/lib/scenario";
import type { LandCover } from "@/lib/types";

const mockCover: LandCover = {
  vegetation: 20,
  soil: 10,
  water: 5,
  buildings: 25,
  pavement: 40,
};

const mockBBox = {
  north: 40.76,
  south: 40.75,
  east: -73.98,
  west: -73.99,
};

describe("ScenarioStudio component", () => {
  it("renders intervention options correctly", () => {
    render(
      <ScenarioStudio
        cover={mockCover}
        bbox={mockBBox}
        scenario={EMPTY_SCENARIO}
        activeIntervention={null}
        onInterventionSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Street trees & pocket parks")).toBeInTheDocument();
    expect(screen.getByText("Bioswales & rain gardens")).toBeInTheDocument();
    expect(screen.getByText("Permeable pavement")).toBeInTheDocument();
    expect(screen.getByText("Green roofs")).toBeInTheDocument();
  });

  it("triggers onInterventionSelect when draw button is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ScenarioStudio
        cover={mockCover}
        bbox={mockBBox}
        scenario={EMPTY_SCENARIO}
        activeIntervention={null}
        onInterventionSelect={onSelect}
      />
    );

    const drawButtons = screen.getAllByRole("button", { name: /draw/i });
    drawButtons[0].click();
    expect(onSelect).toHaveBeenCalled();
  });

  it("counts what each tool has drawn and explains tools that can't be modeled", () => {
    const onSelect = vi.fn();
    render(
      <ScenarioStudio
        cover={mockCover}
        bbox={mockBBox}
        scenario={{ ...EMPTY_SCENARIO, street_trees: 0.05 }}
        activeIntervention={null}
        onInterventionSelect={onSelect}
        drawn={{ street_trees: { count: 2, areaM2: 1250 } }}
        unavailable={{ green_roofs: "Needs mapped building footprints." }}
      />
    );

    expect(screen.getByText(/2 shapes · 1,250 m² · 5\.0% of pavement/)).toBeInTheDocument();
    const roofs = screen.getByRole("button", { name: /green roofs/i });
    expect(roofs).toBeDisabled();
    expect(roofs).toHaveTextContent("Needs mapped building footprints.");
    roofs.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
