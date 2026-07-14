import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Index from "@/pages/Index";
import { ABSORPTION_WEIGHTS } from "@/lib/absorption";

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
    // that the score is auditable, so every weight must actually be on the page,
    // and it must be the weight the model actually applies.
    renderLanding();
    for (const label of ["Vegetation", "Bare soil", "Buildings", "Pavement"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const [key, weight] of Object.entries(ABSORPTION_WEIGHTS)) {
      expect(
        screen.getByText(weight.toFixed(2)),
        `the page must publish the ${key} weight actually in use`
      ).toBeInTheDocument();
    }
  });

  it("discloses that open water is excluded, rather than quietly omitting it", () => {
    // Water used to be weighted 0.50 -- scoring a harbour as a half-strength
    // sponge, which rewarded a site for being flood-exposed. Dropping it from
    // the model silently would be its own kind of dishonesty: the page has to
    // say the class exists and say why it earns nothing.
    renderLanding();
    expect(screen.getByText(/open water/i)).toBeInTheDocument();
    expect(screen.getByText(/excluded/i)).toBeInTheDocument();
    expect(screen.getByText(/where the runoff goes/i)).toBeInTheDocument();
  });
});
