import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Index from "@/pages/Index";

function renderLanding() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>
  );
}

describe("landing page", () => {
  it("does not present the hero sample as a live scan", () => {
    // The hero runs the real gauge and breakdown components on a fixed
    // composition. That is fine -- it shows the product honestly. What is not
    // fine is dressing it up as something that happened: it used to read
    // "2.1 km² · scanned just now", which was a claim, and a false one.
    // Anything here that reads as a live measurement is fabricated data.
    renderLanding();
    expect(screen.queryByText(/scanned just now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\.1 km/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sample analysis/i)).toBeInTheDocument();
  });

  it("shows no invented usage statistics", () => {
    // The metric strip states facts about the product (5 land-cover classes,
    // 0-100 score). It must never drift back into invented traction numbers.
    renderLanding();
    for (const lie of [/active users/i, /cities analyzed/i, /hectares/i, /trusted by/i]) {
      expect(screen.queryByText(lie)).not.toBeInTheDocument();
    }
  });

  it("publishes the full scoring weight table", () => {
    // The methodology section is the page's credibility anchor: the claim is
    // that the score is auditable, so every weight must actually be on the page.
    renderLanding();
    for (const label of ["Vegetation", "Bare soil", "Water", "Buildings", "Pavement"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("1.00")).toBeInTheDocument();
    expect(screen.getByText("0.85")).toBeInTheDocument();
  });
});
