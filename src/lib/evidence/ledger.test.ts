import { describe, expect, it } from "vitest";
import { EVIDENCE_LEDGER, ROUTED_ZONES_CAVEAT, experimentVerdict } from "./ledger";
import { EXPERIMENTS } from "@/lib/validation/registry";

describe("evidence ledger", () => {
  it("cites only registered experiments that have committed results", () => {
    const registered = new Set(EXPERIMENTS.map((e) => e.spec.id));
    for (const entry of EVIDENCE_LEDGER) {
      for (const id of entry.experiments) {
        expect(registered.has(id), id).toBe(true);
        expect(experimentVerdict(id), id).not.toBeNull();
      }
    }
  });

  it("never calls a component validated when its evidence failed or is absent", () => {
    expect(EVIDENCE_LEDGER.find((e) => e.id === "routing")?.validation).toBe("failed");
    for (const entry of EVIDENCE_LEDGER) {
      if (entry.experiments.length === 0) expect(entry.validation).toBe("unvalidated");
    }
    expect(EVIDENCE_LEDGER.some((e) => e.validation === "externally-tested")).toBe(false);
  });

  it("states the holdout result in plain language", () => {
    expect(ROUTED_ZONES_CAVEAT).toMatch(/no better than chance/);
  });
});
