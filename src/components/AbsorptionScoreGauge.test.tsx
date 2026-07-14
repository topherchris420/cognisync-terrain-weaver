import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";

describe("AbsorptionScoreGauge", () => {
  it("labels a high score as resilient", () => {
    render(<AbsorptionScoreGauge score={90} animated={false} />);
    expect(screen.getByText("Resilient")).toBeInTheDocument();
  });

  it("labels a low score as critical", () => {
    render(<AbsorptionScoreGauge score={10} animated={false} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("clamps a score above 100", () => {
    render(<AbsorptionScoreGauge score={150} animated={false} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it.each([10, 50, 90])(
    "renders no width-styled bar at score %i -- the arc encodes the score, not a bar",
    (score) => {
      const { container } = render(
        <AbsorptionScoreGauge score={score} animated={false} />
      );
      // There used to be a "risk meter" bar here filling to (100 - score), so a
      // site scoring 90 rendered a 10% bar directly beneath an arc that had just
      // filled to 90% -- two unlabelled indicators moving in opposite directions.
      // The invariant is stronger than "not 10%": this component encodes the
      // score solely through the arc's stroke-dashoffset, so nothing in it
      // should carry an inline width at all.
      expect(
        container.querySelectorAll<HTMLElement>("[style*='width']")
      ).toHaveLength(0);
    }
  );

  it("emits no duplicate gradient id when two gauges render together", () => {
    // The arc renders via a stroke class; the <defs> gradient it once declared
    // was never referenced, and would collide on any page showing two gauges.
    const { container } = render(
      <>
        <AbsorptionScoreGauge score={74} animated={false} />
        <AbsorptionScoreGauge score={31} animated={false} />
      </>
    );
    expect(container.querySelectorAll("#score-gradient")).toHaveLength(0);
  });
});
