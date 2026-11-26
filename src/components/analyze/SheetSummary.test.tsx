import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SheetSummary } from "./SheetSummary";

describe("lowered sheet summary", () => {
  it("leads with the paired change under the same storm", () => {
    const view = render(<SheetSummary pair={{ nowM3: 30299.7, possibleM3: 30218.2 }} showDifference showFlow />);
    expect(view.container).toHaveTextContent("Same storm: 82 m³ less runoff in this model (0.3%). Green cells on the map carry less water.");
  });

  it("says more, in amber, when a redesign sends more water", () => {
    const view = render(<SheetSummary pair={{ nowM3: 1000, possibleM3: 1100 }} showDifference showFlow />);
    expect(view.container).toHaveTextContent("100 m³ more runoff in this model (10%). Amber cells on the map carry more water.");
  });

  it("does not describe a difference layer that is switched off", () => {
    const view = render(<SheetSummary pair={{ nowM3: 1000, possibleM3: 900 }} showDifference={false} showFlow />);
    expect(view.container).not.toHaveTextContent(/cells on the map/);
  });

  it("falls back to the flow key without a valid pair, and to nothing without flow paths", () => {
    const flow = render(<SheetSummary pair={{ nowM3: Number.NaN, possibleM3: 900 }} showDifference showFlow />);
    expect(flow.container).toHaveTextContent("Flow paths are brightest where modeled water gathers. Not flood depth.");
    flow.unmount();
    const empty = render(<SheetSummary pair={null} showDifference={false} showFlow={false} />);
    expect(empty.container).toBeEmptyDOMElement();
  });
});
