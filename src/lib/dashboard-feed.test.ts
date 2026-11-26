import { describe, expect, it, vi } from "vitest";
import { fetchDashboardFeed, loadDashboardSnapshot } from "./dashboard-feed";

describe("dashboard feed fallback", () => {
  it("uses live data without loading the snapshot", async () => {
    const loadSnapshot = vi.fn();
    const signal = new AbortController().signal;
    const loadLive = vi.fn().mockResolvedValue([]);
    await expect(fetchDashboardFeed(signal, loadLive, loadSnapshot)).resolves.toEqual({ rows: [] });
    expect(loadLive).toHaveBeenCalledWith(signal);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("shows the dated, read-only fixture during an outage", async () => {
    const loadLive = vi.fn().mockRejectedValue(new Error("live feed unavailable"));
    const feed = await fetchDashboardFeed(new AbortController().signal, loadLive);
    expect(feed.snapshot?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(feed.rows.length).toBeGreaterThan(0);
    expect(feed.rows[0]).toMatchObject({
      name: "",
      image_data_url: null,
      ai_notes: null,
      recommendations: [],
    });
    const dates = feed.rows.map((row) => row.created_at);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it("preserves the live error if the snapshot cannot be loaded", async () => {
    const liveError = new Error("live feed unavailable");
    const loadLive = vi.fn().mockRejectedValue(liveError);
    const loadSnapshot = vi.fn().mockRejectedValue(new Error("fixture unavailable"));
    await expect(
      fetchDashboardFeed(new AbortController().signal, loadLive, loadSnapshot),
    ).rejects.toBe(liveError);
  });

  it("does not fall back on a cancelled live request", async () => {
    const controller = new AbortController();
    const loadSnapshot = vi.fn();
    const loadLive = vi.fn(async () => {
      controller.abort();
      throw new Error("cancelled");
    });
    await expect(fetchDashboardFeed(controller.signal, loadLive, loadSnapshot)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("does not publish a snapshot after cancellation during fixture loading", async () => {
    const controller = new AbortController();
    const loadLive = vi.fn().mockRejectedValue(new Error("live outage"));
    const loadSnapshot = vi.fn(async () => {
      controller.abort();
      return loadDashboardSnapshot();
    });
    await expect(fetchDashboardFeed(controller.signal, loadLive, loadSnapshot)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
