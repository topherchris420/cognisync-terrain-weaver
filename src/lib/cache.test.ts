import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalysisCache } from "./cache";

describe("AnalysisCache", () => {
  let cache: AnalysisCache<string>;

  beforeEach(() => {
    cache = new AnalysisCache<string>(3, 1000); // max size 3, TTL 1000ms
  });

  it("generates stable cache keys", () => {
    const key1 = cache.generateKey(40.7128, -74.006, 15, { storm: "50mm" });
    const key2 = cache.generateKey(40.7128, -74.006, 15, { storm: "50mm" });
    expect(key1).toBe(key2);
    expect(key1).toContain("40.712800:-74.006000:15:");
  });

  it("stores and retrieves values", () => {
    const key = cache.generateKey(40.7, -74.0, 10);
    cache.set(key, "result-data");
    expect(cache.get(key)).toBe("result-data");
  });

  it("respects TTL expiration", () => {
    vi.useFakeTimers();
    const key = cache.generateKey(40.7, -74.0, 10);
    cache.set(key, "data");

    vi.advanceTimersByTime(500);
    expect(cache.get(key)).toBe("data");

    vi.advanceTimersByTime(600); // 1100ms total > 1000ms TTL
    expect(cache.get(key)).toBeUndefined();
    vi.useRealTimers();
  });

  it("evicts least recently used item when max size is exceeded", () => {
    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.set("k3", "v3");

    // Access k1 to make k2 the LRU item
    cache.get("k1");

    // Insert k4 -> should evict k2
    cache.set("k4", "v4");

    expect(cache.get("k1")).toBe("v1");
    expect(cache.get("k2")).toBeUndefined();
    expect(cache.get("k3")).toBe("v3");
    expect(cache.get("k4")).toBe("v4");
  });

  it("clears all cache entries", () => {
    cache.set("k1", "v1");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("k1")).toBeUndefined();
  });
});
