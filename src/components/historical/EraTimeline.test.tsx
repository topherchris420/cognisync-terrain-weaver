import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ERAS } from "@/lib/historical/eras";
import { EraTimeline } from "./EraTimeline";

const MIDTOWN = { lat: 40.758, lng: -73.985 };
const DENVER = { lat: 39.74, lng: -104.99 };

function renderTimeline(props: Partial<Parameters<typeof EraTimeline>[0]> = {}) {
  return render(
    <EraTimeline eraId="1924" onChange={() => {}} onCompare={() => {}} center={MIDTOWN} {...props} />
  );
}

describe("EraTimeline", () => {
  it("offers every timeline entry", () => {
    renderTimeline();
    expect(screen.getAllByRole("radio").map((el) => el.textContent)).toEqual(
      ERAS.map((era) => era.label)
    );
  });

  it("says when imagery is loading", () => {
    renderTimeline({ status: { phase: "loading" } });
    expect(screen.getByRole("status")).toHaveTextContent("Loading 1924 imagery");
  });

  it("is silent once the imagery is drawn", () => {
    renderTimeline({ status: { phase: "ready" } });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains an unavailable year without offering a pointless retry", () => {
    renderTimeline({
      status: { phase: "unavailable", message: "1924 imagery is unavailable: the publisher answered 404." },
      onRetry: vi.fn(),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Unavailable.*answered 404/);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("offers a retry for a transient error", () => {
    const onRetry = vi.fn();
    renderTimeline({
      status: { phase: "error", message: "1924 tiles failed to load.", retriable: true },
      onRetry,
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("explains missing coverage instead of a load state outside the city", () => {
    renderTimeline({ center: DENVER, status: { phase: "empty", message: "No 1924 imagery" } });
    expect(screen.getByText(/published only for the city/)).toBeInTheDocument();
    expect(screen.queryByText("No 1924 imagery")).toBeNull();
  });

  it("documents the source, capture date and limits of the layer", () => {
    renderTimeline({ eraId: "2016" });
    expect(screen.getByText("Source & limits")).toBeInTheDocument();
    expect(screen.getByText("26 March – 5 April 2016")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining("NYC_Orthos_2016/MapServer")
    );
    expect(screen.getByText(/no 3D building model exists for this year/)).toBeInTheDocument();
  });

  it("labels the 1609 layer as a reconstruction, not a photograph", () => {
    renderTimeline({ eraId: "1609" });
    expect(screen.getByText("Reconstruction")).toBeInTheDocument();
    expect(screen.getByText(/not a photograph/)).toBeInTheDocument();
  });
});
