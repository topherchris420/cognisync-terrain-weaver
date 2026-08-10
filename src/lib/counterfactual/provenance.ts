import { stableHash } from "./hashing";
import type { DataProvenance } from "./types";

export function assertCompleteProvenance(items: DataProvenance[]): void {
  items.forEach((item, index) => {
    const missing: string[] = [];

    if (!item.sourceId.trim()) {
      missing.push("sourceId");
    }

    if (!item.url.trim()) {
      missing.push("url");
    }

    if (missing.length > 0) {
      throw new Error(
        `Provenance item ${index} is missing required ${missing.join(" and ")}`
      );
    }
  });
}

export function combineProvenance(items: DataProvenance[]): DataProvenance[] {
  assertCompleteProvenance(items);

  const seen = new Set<string>();
  const combined: DataProvenance[] = [];

  for (const item of items) {
    const key = stableHash(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    combined.push(item);
  }

  return combined;
}
