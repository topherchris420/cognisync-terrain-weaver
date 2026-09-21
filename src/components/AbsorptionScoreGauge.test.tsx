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

  it("keeps the status word and the risk pill on the same band boundary", () => {
    // A score of 58 is "low" risk (>= 55). The status word once used its own
    // 65 threshold, so it read "Vulnerable" beside a "Low" pill. Both must now
    // derive from the same band: a low-risk score reads "Resilient".
    render(<AbsorptionScoreGauge score={58} animated={false} />);
    expect(screen.getByText("Resilient")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.queryByText("Vulnerable")).not.toBeInTheDocument();
  });

  it("labels a moderate-band score as vulnerable", () => {
    // 40 sits in the moderate band (35–54); status and pill agree.
    render(<AbsorptionScoreGauge score={40} animated={false} />);
    expect(screen.getByText("Vulnerable")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
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
