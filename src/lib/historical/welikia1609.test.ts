import { describe, expect, it } from "vitest";
import { queryWelikia1609 } from "./welikia1609";

const payload = {
  version: 1,
  source: {
    title: "Welikia Project 1609 ecological communities, by city block",
    agency: "Wildlife Conservation Society / New York Botanical Garden",
    url: "https://www.welikia.org/map-explorer",
    accessedAt: "2026-09-08",
    method: "Published per-block shares reduced to bounding boxes.",
  },
  communities: ["Oak-hickory forest", "Salt marsh"],
  blocks: [
    [-74.01, 40.7, -74.0, 40.71, 90, 8, 2, 0],
    [-74.0, 40.7, -73.99, 40.71, 40, 10, 50, 1],
  ],
} as unknown as Parameters<typeof queryWelikia1609>[0];

describe("queryWelikia1609", () => {
  it("reports observed cover for a block inside the city", () => {
    const result = queryWelikia1609(payload, {
      west: -74.01,
      south: 40.7,
      east: -74.0,
      north: 40.71,
    });
    expect(result.status).toBe("observed");
    expect(result.blockCount).toBe(1);
    expect(result.landCover).toEqual({
      vegetation: 90,
      soil: 8,
      water: 2,
      buildings: 0,
      pavement: 0,
    });
    expect(result.dominantCommunities).toEqual(["Oak-hickory forest"]);
    expect(result.absorptionScore).toBeGreaterThan(0);
  });

  it("area-weights across overlapping blocks and always sums to 100", () => {
    const result = queryWelikia1609(payload, {
      west: -74.01,
      south: 40.7,
      east: -73.99,
      north: 40.71,
    });
    expect(result.blockCount).toBe(2);
    const cover = result.landCover!;
    expect(cover.vegetation + cover.soil + cover.water).toBe(100);
    expect(cover.vegetation).toBe(65);
    expect(cover.buildings).toBe(0);
    expect(cover.pavement).toBe(0);
  });

  it("is unavailable outside New York City", () => {
    const result = queryWelikia1609(payload, {
      west: 12.4,
      south: 41.9,
      east: 12.5,
      north: 41.95,
    });
    expect(result.status).toBe("unavailable");
    expect(result.landCover).toBeNull();
    expect(result.absorptionScore).toBeNull();
    expect(result.unavailableReason).toMatch(/New York City only/);
  });

  it("is unavailable inside the city where no block is reconstructed", () => {
    const result = queryWelikia1609(payload, {
      west: -73.8,
      south: 40.6,
      east: -73.79,
      north: 40.61,
    });
    expect(result.status).toBe("unavailable");
    expect(result.blockCount).toBe(0);
    expect(result.unavailableReason).toMatch(/No reconstructed block/);
  });
});
