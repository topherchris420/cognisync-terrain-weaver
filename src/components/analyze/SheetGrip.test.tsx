import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheetGrip } from "./SheetGrip";

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientY. A
// MouseEvent carries the coordinates the grip reads.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

function grip(peek: boolean) {
  const onPeekChange = vi.fn();
  const view = render(<SheetGrip peek={peek} onPeekChange={onPeekChange} controls="study-workbench" />);
  return { onPeekChange, button: view.getByRole("button") };
}

describe("phone study sheet grip", () => {
  it("names what a tap will do and reports the sheet's state", () => {
    const full = grip(false).button;
    expect(full).toHaveAccessibleName(/lower the study panel to see the map/i);
    expect(full).toHaveAttribute("aria-expanded", "true");
    expect(full).toHaveAttribute("aria-controls", "study-workbench");
  });

  it("toggles on a tap", () => {
    const lowered = grip(true);
    expect(lowered.button).toHaveAccessibleName(/expand the study panel/i);
    expect(lowered.button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(lowered.button);
    expect(lowered.onPeekChange).toHaveBeenCalledWith(false);
  });

  it("lowers on a swipe down and ignores the click that ends the swipe", () => {
    const { button, onPeekChange } = grip(false);
    fireEvent.pointerDown(button, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 180, pointerId: 1 });
    fireEvent.click(button);
    expect(onPeekChange).toHaveBeenCalledTimes(1);
    expect(onPeekChange).toHaveBeenCalledWith(true);
  });

  it("raises on a swipe up", () => {
    const { button, onPeekChange } = grip(true);
    fireEvent.pointerDown(button, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 220, pointerId: 1 });
    expect(onPeekChange).toHaveBeenCalledWith(false);
  });

  it("treats a small wobble as a tap, not a swipe", () => {
    const { button, onPeekChange } = grip(false);
    fireEvent.pointerDown(button, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 108, pointerId: 1 });
    fireEvent.click(button);
    expect(onPeekChange).toHaveBeenCalledTimes(1);
    expect(onPeekChange).toHaveBeenCalledWith(true);
  });
});
