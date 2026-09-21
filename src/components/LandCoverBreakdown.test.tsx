import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import type { LandCover } from "@/lib/types";

// The vision model returns five independent percentages. It does not guarantee
// they sum to 100, and in practice they often don't.
const sums100: LandCover = {
  vegetation: 30, soil: 10, water: 5, buildings: 25, pavement: 30,
};
const sums97: LandCover = {
  vegetation: 30, soil: 10, water: 5, buildings: 22, pavement: 30,
};
const sums103: LandCover = {
  vegetation: 33, soil: 10, water: 5, buildings: 25, pavement: 30,
};

describe("LandCoverBreakdown", () => {
  it("reports 100% when the classes really do sum to 100", () => {
    render(<LandCoverBreakdown cover={sums100} animated={false} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports the real total when the classes sum to 97, not a hardcoded 100", () => {
    render(<LandCoverBreakdown cover={sums97} animated={false} />);
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("reports the real total when the classes sum to 103", () => {
    render(<LandCoverBreakdown cover={sums103} animated={false} />);
    expect(screen.getByText("103%")).toBeInTheDocument();
  });

  it("warns when the classification does not sum to 100", () => {
    render(<LandCoverBreakdown cover={sums97} animated={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(/does not sum to 100/i);
  });

  it("renders every land-cover class", () => {
    render(<LandCoverBreakdown cover={sums100} animated={false} />);
    for (const label of ["Vegetation", "Bare soil", "Water", "Buildings", "Pavement"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
