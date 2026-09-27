import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Tactical from "./Tactical";
vi.mock("@/components/AppNav", () => ({ AppNav: () => null }));
describe("retired tactical route", () => {
  it("never turns query coordinates into a hazard map", () => {
    render(<MemoryRouter initialEntries={["/tactical?lat=NaN&lng=999&label=Severe"]}><Tactical /></MemoryRouter>);
    expect(screen.getByText(/No completed simulation is loaded/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /resilience workstation/ })).toHaveAttribute("href", "/");
    expect(screen.queryByText("Emergency Operations Common Operating Picture")).not.toBeInTheDocument();
  });
});
