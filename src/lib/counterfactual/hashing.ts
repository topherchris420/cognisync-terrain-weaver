const FNV1A64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV1A64_PRIME = 0x100000001b3n;
const FNV1A64_MASK = 0xffffffffffffffffn;

function unsupported(reason: string): never {
  throw new TypeError(`stableHash cannot hash ${reason}`);
}

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return unsupported("undefined values");
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return unsupported("non-finite numbers");
    }

    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "function") {
    return unsupported("functions");
  }

  if (typeof value === "symbol") {
    return unsupported("symbols");
  }

  if (typeof value === "bigint") {
    return unsupported("bigints");
  }

  if (typeof value !== "object") {
    return unsupported(`values of type ${typeof value}`);
  }

  if (seen.has(value)) {
    return unsupported("cyclic objects");
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const parts: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          return unsupported("undefined array entries");
        }

        parts.push(canonicalize(value[index], seen));
      }
      return `[${parts.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return unsupported("non-plain JSON objects");
    }

    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key], seen)}`);
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

function fnv1a64(input: string): string {
  let hash = FNV1A64_OFFSET_BASIS;

  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV1A64_PRIME) & FNV1A64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

/**
 * Deterministic identity key for counterfactual contracts.
 * This is not a security checksum.
 */
export function stableHash(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalize(value, new Set<object>()))}`;
}
