import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemporalLens } from "./TemporalLens";

describe("TemporalLens", () => {
  it("switches between historical, present, and future states", () => {
    const onChange = vi.fn();
    render(
      <TemporalLens
        epoch="2026"
        onChange={onChange}
        unlocked={true}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /\+/i }));
    expect(onChange).toHaveBeenCalledWith("future");
  });

  it("limits timeline to 2026 when locked", () => {
    render(
      <TemporalLens
        epoch="2026"
        onChange={() => undefined}
        unlocked={false}
      />
    );

    expect(screen.getByText("1609")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation with arrow keys", () => {
    const onChange = vi.fn();
    render(
      <TemporalLens
        epoch="1609"
        onChange={onChange}
        unlocked={true}
      />
    );

    const radiogroup = screen.getByRole("radiogroup", { name: /temporal lens/i });
    fireEvent.keyDown(radiogroup, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("2026");
  });
});
