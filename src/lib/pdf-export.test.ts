import { describe, it, expect } from "vitest";
import { generatePDFReport } from "@/lib/pdf-export";
import type { AnalysisRecord } from "@/lib/types";

const record: AnalysisRecord = {
  id: "test-1",
  name: "Test Site",
  location_label: "Manhattan, NY",
  center_lat: 40.758,
  center_lng: -73.985,
  zoom: 15,
  bbox: null,
  image_data_url: null,
  land_cover: { vegetation: 18, soil: 6, water: 4, buildings: 41, pavement: 31 },
  // 58 is the score that used to print VULNERABLE above "Flood Risk: Low".
  absorption_score: 58,
  flood_risk: "low",
  recommendations: [],
  ai_notes: null,
  status: "complete",
  created_at: new Date().toISOString(),
};

/** Pull the literal strings jsPDF wrote into the content stream. */
function textOf(doc: ReturnType<typeof generatePDFReport>): string {
  const raw = doc.output("arraybuffer");
  return new TextDecoder("latin1").decode(new Uint8Array(raw));
}

describe("PDF export", () => {
  it("generates without throwing", () => {
    expect(() => generatePDFReport(record)).not.toThrow();
  });

  it("prints a status word that agrees with the risk band", () => {
    const text = textOf(generatePDFReport(record));
    expect(text).toContain("RESILIENT");
    expect(text).not.toContain("VULNERABLE");
    expect(text).toContain("Flood Risk: Low");
  });

  it("carries the 1609 baseline section", () => {
    const text = textOf(generatePDFReport(record));
    expect(text).toContain("Against the 1609 Baseline");
    expect(text).toContain("79.1");
    expect(text).toMatch(/73%/);
  });

  it("labels the baseline as an estimate, not a WCS publication", () => {
    const text = textOf(generatePDFReport(record));
    expect(text).toMatch(/not[\s\\()]*published by it/);
  });
});
