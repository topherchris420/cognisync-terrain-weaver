import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningEnvelope } from "./PlanningEnvelope";
describe("planning envelope", () => {
  it("makes an impossible budget visible without claiming a spatial plan", () => {
    render(<PlanningEnvelope cover={{ pavement: 100, vegetation: 0, soil: 0, water: 0, buildings: 0 }} areaM2={1000} />);
    fireEvent.change(screen.getByLabelText("Installation budget (USD)"), { target: { value: "0" } });
    expect(screen.getByRole("status")).toHaveTextContent("Not achievable");
    expect(screen.getByRole("status")).toHaveTextContent("binding constraint: budget");
    fireEvent.change(screen.getByLabelText("Installation budget (USD)"), { target: { value: "55000" } });
    fireEvent.change(screen.getByLabelText("Target score"), { target: { value: "85" } });
    expect(screen.getByRole("status")).toHaveTextContent("Target achievable");
    expect(screen.getByText(/does not place drawings/)).toBeInTheDocument();
  });
});
