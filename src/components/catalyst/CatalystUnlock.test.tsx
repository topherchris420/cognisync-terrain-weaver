import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalystUnlock } from "./CatalystUnlock";

describe("CatalystUnlock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("starts a hold but does not unlock on early release", () => {
    const onUnlock = vi.fn();
    render(<CatalystUnlock baselineScore={79.1} onUnlock={onUnlock} />);

    const button = screen.getByRole("button", {
      name: /unlock catalyst temporal lens/i,
    });
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(900));
    fireEvent.pointerUp(button);
    act(() => vi.advanceTimersByTime(1400));

    expect(onUnlock).not.toHaveBeenCalled();
    expect(localStorage.getItem("mannahatta:catalyst-unlocked")).toBeNull();
  });

  it("unlocks after a complete hold and persists discovery", () => {
    const onUnlock = vi.fn();
    render(<CatalystUnlock baselineScore={79.1} onUnlock={onUnlock} />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: /unlock catalyst temporal lens/i })
    );
    act(() => vi.advanceTimersByTime(2000));

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("mannahatta:catalyst-unlocked")).toBe("true");
    expect(screen.getByText(/historical layer/i)).toBeInTheDocument();
  });

  it("supports intentional keyboard hold activation", () => {
    const onUnlock = vi.fn();
    render(<CatalystUnlock baselineScore={79.1} onUnlock={onUnlock} />);

    const button = screen.getByRole("button", {
      name: /unlock catalyst temporal lens/i,
    });
    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(2000));

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("does not depend on motion animations to unlock", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    const onUnlock = vi.fn();
    render(<CatalystUnlock baselineScore={79.1} onUnlock={onUnlock} />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: /unlock catalyst temporal lens/i })
    );
    act(() => vi.advanceTimersByTime(2000));

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
