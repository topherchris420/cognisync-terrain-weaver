import { describe, expect, it } from "vitest";
import { stableHash } from "./hashing";

describe("stableHash", () => {
  it("ignores object key order but preserves array order", () => {
    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });

  it("renders a deterministic fnv1a64 identity key", () => {
    expect(stableHash({ a: 1, b: 2 })).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it("rejects unsupported values and cycles", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(() => stableHash(undefined)).toThrow(/undefined/i);
    expect(() => stableHash(Number.NaN)).toThrow(/finite/i);
    expect(() => stableHash(Infinity)).toThrow(/finite/i);
    expect(() => stableHash({ fn: () => true })).toThrow(/function/i);
    expect(() => stableHash({ symbol: Symbol("x") })).toThrow(/symbol/i);
    expect(() => stableHash(cyclic)).toThrow(/cyclic/i);
  });

  it("rejects non-plain objects", () => {
    const nonPlainValues = [
      new Date("2026-08-09T00:00:00Z"),
      new Map([["a", 1]]),
      new Set([1]),
      /mannahatta/,
    ];

    for (const value of nonPlainValues) {
      expect(() => stableHash(value)).toThrow(/plain JSON objects/i);
    }
  });
});
