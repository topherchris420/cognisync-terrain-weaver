import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RecentScans } from "@/components/RecentScans";

const { mockLimit } = vi.hoisted(() => ({ mockLimit: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        not: () => ({
          order: () => ({ limit: mockLimit }),
        }),
      }),
    }),
  },
}));

const rows = [
  { id: "1", name: "Central Jakarta", location_label: "Jakarta, ID", absorption_score: 27.3 },
  { id: "2", name: "Copenhagen Østerbro", location_label: "Copenhagen, DK", absorption_score: 34 },
];

function renderIt() {
  return render(
    <MemoryRouter>
      <RecentScans />
    </MemoryRouter>
  );
}

describe("RecentScans", () => {
  beforeEach(() => mockLimit.mockReset());

  it("renders the real scans the database returned", async () => {
    mockLimit.mockResolvedValue({ data: rows, error: null });
    renderIt();
    await waitFor(() => {
      expect(screen.getByText("Jakarta, ID")).toBeInTheDocument();
      expect(screen.getByText("Copenhagen, DK")).toBeInTheDocument();
      expect(screen.getByText("27")).toBeInTheDocument();
    });
  });

  it("renders nothing when the feed is empty -- never placeholder cities", async () => {
    // The entire argument for this strip is that the numbers are real. An empty
    // feed must produce an absent section, not a plausible-looking fake one.
    mockLimit.mockResolvedValue({ data: [], error: null });
    const { container } = renderIt();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing when the query fails -- never invented scores", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { container } = renderIt();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
