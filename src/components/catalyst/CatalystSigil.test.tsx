import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CatalystSigil } from "./CatalystSigil";
import { CATALYST_HOLD_MS } from "@/lib/catalyst";

function hold(el: HTMLElement, ms: number) {
  fireEvent.keyDown(el, { key: " " });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("CatalystSigil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // rAF under fake timers, so the hold can be driven deterministically.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  it("opens the layer only after a sustained hold", () => {
    const onUnlock = vi.fn();
    render(<CatalystSigil text="79.1" unlocked={false} onUnlock={onUnlock} />);
    const sigil = screen.getByTestId("catalyst-sigil");

    hold(sigil, CATALYST_HOLD_MS / 4);
    fireEvent.keyUp(sigil, { key: " " });
    expect(onUnlock).not.toHaveBeenCalled();

    hold(sigil, CATALYST_HOLD_MS + 200);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("stays reachable to assistive tech without giving the secret away", () => {
    render(<CatalystSigil text="79.1" unlocked={false} onUnlock={vi.fn()} />);
    const sigil = screen.getByTestId("catalyst-sigil");
    expect(sigil).toHaveAttribute("role", "button");
    expect(sigil.getAttribute("aria-label")).toContain("Press and hold");
    expect(sigil.textContent).toBe("79.1");
  });
});