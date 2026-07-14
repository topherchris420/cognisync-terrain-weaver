import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RecommendationsList } from "@/components/RecommendationsList";
import type { Recommendation } from "@/lib/types";

const items: Recommendation[] = [
  { title: "Bioswales on 3rd", description: "Convert the median.", priority: "high", category: "green" },
  { title: "Retention basin", description: "Buffer peak flow.", priority: "medium", category: "blue" },
];

const replacement: Recommendation[] = [
  { title: "Permeable paving", description: "Replace asphalt.", priority: "low", category: "gray" },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("RecommendationsList", () => {
  it("reveals every recommendation once the stagger completes", () => {
    vi.useFakeTimers();
    render(<RecommendationsList items={items} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Bioswales on 3rd")).toBeInTheDocument();
    expect(screen.getByText("Retention basin")).toBeInTheDocument();
  });

  it("clears its timers on unmount, so it cannot set state on a dead component", () => {
    vi.useFakeTimers();
    const { unmount } = render(<RecommendationsList items={items} />);
    // The stagger schedules one timer per item. They were never cleared, so
    // unmounting mid-reveal left them pending and firing into nothing.
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts a new analysis from a clean slate rather than inheriting the last one", () => {
    vi.useFakeTimers();
    const { rerender } = render(<RecommendationsList items={items} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // visibleItems used to accumulate across analyses: a second run appended its
    // indices to the first run's array. With [0,1] left over, the new run's item
    // 0 was already in the set -- so it rendered fully revealed before its own
    // timer had fired. A reset means it must start hidden.
    rerender(<RecommendationsList items={replacement} />);

    const newItem = screen.getByText("Permeable paving").closest("li");
    expect(newItem?.className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Permeable paving").closest("li")?.className).not.toContain(
      "opacity-0"
    );
    expect(screen.queryByText("Bioswales on 3rd")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no recommendations", () => {
    render(<RecommendationsList items={[]} />);
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
  });
});
