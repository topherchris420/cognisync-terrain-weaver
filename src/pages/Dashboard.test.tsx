import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import Dashboard from "./Dashboard";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: () => ({ abortSignal: request }) }),
      }),
    }),
  },
}));
vi.mock("@/components/AppNav", () => ({ AppNav: () => null }));

describe("public index outage", () => {
  it("shows the dated fallback and replaces it after a successful retry", async () => {
    request
      .mockResolvedValueOnce({ data: null, error: { message: "service detail" } })
      .mockResolvedValueOnce({
        data: [{ ...EXAMPLE_ANALYSIS, name: "Live recovery site" }],
        error: null,
      });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><Dashboard /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/showing a read-only snapshot captured on/i)).toBeVisible();
    expect(screen.queryByText(/service detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Central Park, NYC" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Live recovery site" })).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText(/showing a read-only snapshot/i)).not.toBeInTheDocument(),
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});
