import { afterEach, describe, expect, it, vi } from "vitest";
import { pngBytes, tileResponse } from "@/test/fake-map";
import { ERAS, getEra } from "./eras";
import {
  INITIAL_TRACKER,
  MAX_AUTO_RELOADS,
  MAX_TILE_FAILURES,
  PROBE_RETRIES,
  isImageBytes,
  lngLatToTile,
  probeEraImagery,
  probeEraImageryCached,
  probeUrls,
  reduceImagery,
  resetEraProbeCache,
  type ImageryEvent,
  type ImageryTrackerState,
} from "./era-imagery";

const noSleep = () => Promise.resolve();
const html = new TextEncoder().encode("<!DOCTYPE html><html><body>Moved</body></html>");

afterEach(() => resetEraProbeCache());

function distinctTiles(): typeof fetch {
  let n = 0;
  return vi.fn(async () => tileResponse(pngBytes(++n))) as unknown as typeof fetch;
}

describe("probe URLs", () => {
  it("converts a coordinate to its slippy-map tile", () => {
    expect(lngLatToTile(-73.985, 40.758, 16)).toEqual({ x: 19299, y: 24629, z: 16 });
  });

  it.each(ERAS.filter((era) => era.tiles).map((era) => [era.id, era] as const))(
    "%s probes two different tiles of its own service",
    (_id, era) => {
      const urls = probeUrls(era);
      expect(urls).toHaveLength(2);
      expect(urls[0]).not.toBe(urls[1]);
      for (const url of urls) {
        expect(url.startsWith(era.tiles!.split("{z}")[0])).toBe(true);
        expect(url).not.toMatch(/[{}]/);
      }
    }
  );

  it("recognises image bytes by magic number, not content type", () => {
    expect(isImageBytes(pngBytes(1))).toBe(true);
    const jpeg = new Uint8Array(32);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(isImageBytes(jpeg)).toBe(true);
    expect(isImageBytes(html)).toBe(false);
    expect(isImageBytes(new Uint8Array(4))).toBe(false);
  });
});

describe("probeEraImagery", () => {
  const era = getEra("1951");

  it("accepts a service that serves distinct imagery", async () => {
    const fetchImpl = distinctTiles();
    await expect(probeEraImagery(era, { fetchImpl, sleep: noSleep })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects the retired-service placeholder: HTTP 200, same image everywhere", async () => {
    const placeholder = pngBytes(7);
    const fetchImpl = vi.fn(async () => tileResponse(placeholder)) as unknown as typeof fetch;
    const result = await probeEraImagery(era, { fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: false, phase: "unavailable" });
    expect(!result.ok && result.message).toMatch(/placeholder/);
  });

  it("does not apply the placeholder test to projections, whose land tiles are legitimately blank", async () => {
    const blank = pngBytes(3);
    const fetchImpl = vi.fn(async () => tileResponse(blank)) as unknown as typeof fetch;
    await expect(
      probeEraImagery(getEra("slr-3ft"), { fetchImpl, sleep: noSleep })
    ).resolves.toEqual({ ok: true });
  });

  it("reports a 404 as unavailable and never retries it", async () => {
    const fetchImpl = vi.fn(async () => tileResponse(html, 404)) as unknown as typeof fetch;
    const result = await probeEraImagery(era, { fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: false, phase: "unavailable" });
    expect(!result.ok && result.message).toMatch(/404/);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // one per probe tile, no retries
  });

  it("reports HTML served as 200 as unavailable, not as imagery", async () => {
    const fetchImpl = vi.fn(async () => tileResponse(html)) as unknown as typeof fetch;
    const result = await probeEraImagery(era, { fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: false, phase: "unavailable" });
    expect(!result.ok && result.message).toMatch(/not an image/);
  });

  it("retries a transient 503 with backoff and recovers", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls <= 2 ? tileResponse(html, 503) : tileResponse(pngBytes(calls));
    }) as unknown as typeof fetch;
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    await expect(probeEraImagery(era, { fetchImpl, sleep })).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalled();
  });

  it("gives up on network failure after a bounded number of retries", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const result = await probeEraImagery(era, { fetchImpl, sleep });
    expect(result).toMatchObject({ ok: false, phase: "error" });
    expect(fetchImpl).toHaveBeenCalledTimes(2 * (PROBE_RETRIES + 1));
    // Both probe tiles back off 500 ms, then 1 s, in parallel.
    const delays = sleep.mock.calls.map(([ms]) => ms);
    expect(delays.sort((a, b) => a - b)).toEqual([500, 500, 1000, 1000]);
  });
});

describe("probeEraImageryCached", () => {
  it("probes each era once, and never lends one year's verdict to another", async () => {
    const fetchImpl = distinctTiles();
    await probeEraImageryCached(getEra("1924"), { fetchImpl, sleep: noSleep });
    await probeEraImageryCached(getEra("1924"), { fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const missing = vi.fn(async () => tileResponse(html, 404)) as unknown as typeof fetch;
    const other = await probeEraImageryCached(getEra("1996"), { fetchImpl: missing, sleep: noSleep });
    expect(other).toMatchObject({ ok: false, phase: "unavailable" });
    await expect(
      probeEraImageryCached(getEra("1924"), { fetchImpl: missing, sleep: noSleep })
    ).resolves.toEqual({ ok: true });
  });

  it("keeps a definitive answer but asks again after a transient error", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    const era = getEra("2006");
    await expect(
      probeEraImageryCached(era, { fetchImpl: offline, sleep: noSleep })
    ).resolves.toMatchObject({ phase: "error" });
    const online = distinctTiles();
    await expect(
      probeEraImageryCached(era, { fetchImpl: online, sleep: noSleep })
    ).resolves.toEqual({ ok: true });
  });
});

describe("imagery state machine", () => {
  const run = (events: ImageryEvent[], start: ImageryTrackerState = INITIAL_TRACKER) => {
    let state = start;
    const reloads: number[] = [];
    events.forEach((event, i) => {
      const next = reduceImagery(state, event, "1924");
      state = next.state;
      if (next.reload) reloads.push(i);
    });
    return { state, reloads };
  };

  it("goes Loading → Ready on the first tile", () => {
    const { state } = run([{ type: "install" }, { type: "tile-loaded" }]);
    expect(state.status.phase).toBe("ready");
  });

  it("reports Empty when the view settles with nothing published", () => {
    const { state } = run([{ type: "install" }, { type: "idle" }]);
    expect(state.status.phase).toBe("empty");
    expect(state.status.message).toMatch(/No 1924 imagery/);
    expect(run([{ type: "tile-loaded" }], state).state.status.phase).toBe("ready");
  });

  it("reloads once on repeated hard failures, then reports a retriable error", () => {
    const failures: ImageryEvent[] = Array.from({ length: MAX_TILE_FAILURES }, () => ({
      type: "tile-failed",
    }));
    const { state, reloads } = run([
      { type: "install" },
      ...failures,
      { type: "install" },
      ...failures,
    ]);
    expect(reloads).toHaveLength(MAX_AUTO_RELOADS);
    expect(state.status).toMatchObject({ phase: "error", retriable: true });
  });

  it("keeps a drawn layer Ready when a few tiles fail later", () => {
    const { state } = run([
      { type: "install" },
      { type: "tile-loaded" },
      ...Array.from({ length: MAX_TILE_FAILURES + 2 }, () => ({ type: "tile-failed" }) as const),
    ]);
    expect(state.status.phase).toBe("ready");
  });

  it("times out to a retriable error only if nothing ever loaded", () => {
    expect(run([{ type: "install" }, { type: "timeout" }]).state.status).toMatchObject({
      phase: "error",
      retriable: true,
    });
    expect(
      run([{ type: "install" }, { type: "tile-loaded" }, { type: "timeout" }]).state.status.phase
    ).toBe("ready");
  });

  it("holds Unavailable: later tile events cannot resurrect a retired service", () => {
    const { state } = run([
      {
        type: "probe",
        result: { ok: false, phase: "unavailable", message: "gone" },
      },
      { type: "install" },
      { type: "tile-loaded" },
      { type: "idle" },
    ]);
    expect(state.status).toMatchObject({ phase: "unavailable", message: "gone" });
  });
});
