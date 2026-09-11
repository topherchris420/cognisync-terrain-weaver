import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExampleStorm } from "./ExampleStorm";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { parseBBox } from "@/lib/geo";

describe("example rainfall exploration", () => {
  it("updates estimated runoff when rainfall changes and identifies its limitations", () => {
    render(<ExampleStorm cover={EXAMPLE_ANALYSIS.land_cover} bbox={parseBBox(EXAMPLE_ANALYSIS.bbox)!} />);
    const initial = screen.getByTestId("example-runoff").textContent;
    fireEvent.change(screen.getByLabelText(/rainfall depth/i), { target: { value: "100" } });
    expect(screen.getByTestId("example-runoff").textContent).not.toBe(initial);
    expect(screen.getByText(/no elevation routing/i)).toBeInTheDocument();
  });
});
