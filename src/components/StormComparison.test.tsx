import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StormComparison } from "./StormComparison";
import { EMPTY_SCENARIO } from "@/lib/scenario";

afterEach(cleanup);
const cover = { pavement: 100, buildings: 0, vegetation: 0, soil: 0, water: 0 };

describe("StormComparison", () => {
  it("updates the conserved comparison when storm depth or scenario changes", () => {
    const { rerender } = render(<StormComparison cover={cover} scenario={EMPTY_SCENARIO} areaM2={1000} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("50");
    fireEvent.click(screen.getByRole("button", { name: "100 mm" }));
    expect(slider).toHaveValue("100");
    expect(screen.getByRole("button", { name: "100 mm" })).toHaveAttribute("aria-pressed", "true");
    rerender(<StormComparison cover={cover} scenario={{ ...EMPTY_SCENARIO, street_trees: 1 }} areaM2={1000} />);
    expect(screen.getByText("68 m³")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/Runoff volume/);
    fireEvent.change(slider, { target: { value: "0" } });
    expect(screen.getByText(/0.0% less runoff/)).toBeInTheDocument();
  });

  it("explains missing land area instead of implying a zero-risk estimate", () => {
    render(<StormComparison cover={cover} scenario={EMPTY_SCENARIO} areaM2={0} />);
    expect(screen.getByText(/known footprint with land/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
