import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

it("contains an optional chart failure without discarding the surrounding study", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  function FailedChart(): never { throw new Error("Failed to fetch dynamically imported module"); }
  function Study() {
    const [showChart, setShowChart] = useState(false);
    return <>
      <input aria-label="Study name" defaultValue="Lower Manhattan" />
      <button onClick={() => setShowChart(true)}>Show hydrograph</button>
      <ErrorBoundary fallback={<p role="alert">Chart unavailable; study retained.</p>}>
        {showChart && <FailedChart />}
      </ErrorBoundary>
    </>;
  }
  try {
    render(<Study />);
    fireEvent.change(screen.getByLabelText("Study name"), { target: { value: "My revised study" } });
    fireEvent.click(screen.getByRole("button", { name: "Show hydrograph" }));
    expect(screen.getByRole("alert")).toHaveTextContent("study retained");
    expect(screen.getByLabelText("Study name")).toHaveValue("My revised study");
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  } finally { errors.mockRestore(); }
});
