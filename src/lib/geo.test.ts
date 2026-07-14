import { describe, it, expect } from "vitest";
import {
  analysesToCSV,
  analysesToGeoJSON,
  bboxAreaKm2,
  csvEscape,
  parseBBox,
  recordAreaM2,
  type BBox,
} from "./geo";
import type { AnalysisRecord } from "./types";

const record = (partial: Partial<AnalysisRecord>): AnalysisRecord => ({
  id: "abc-123",
  name: "Test site",
  location_label: "Manhattan, NY",
  center_lat: 40.758,
  center_lng: -73.985,
  zoom: 15,
  bbox: null,
  image_data_url: null,
  land_cover: { pavement: 40, buildings: 30, vegetation: 20, water: 5, soil: 5 },
  absorption_score: 28.5,
  flood_risk: "high",
  recommendations: [],
  ai_notes: null,
  status: "complete",
  created_at: "2026-07-14T12:00:00Z",
  ...partial,
});

describe("parseBBox", () => {
  it("accepts a valid [[w,s],[e,n]] box", () => {
    expect(parseBBox([[-74, 40.7], [-73.9, 40.8]])).toEqual([
      [-74, 40.7],
      [-73.9, 40.8],
    ]);
  });

  it("rejects malformed input without throwing", () => {
    expect(parseBBox(null)).toBeNull();
    expect(parseBBox("nope")).toBeNull();
    expect(parseBBox([[1, 2]])).toBeNull();
    expect(parseBBox([["w", "s"], ["e", "n"]])).toBeNull();
    expect(parseBBox([[-200, 40], [-73, 41]])).toBeNull();
    expect(parseBBox([[-74, 95], [-73, 96]])).toBeNull();
  });

  it("rejects boxes with inverted latitudes", () => {
    expect(parseBBox([[-74, 41], [-73, 40]])).toBeNull();
  });
});

describe("bboxAreaKm2", () => {
  it("measures a 1°×1° box at the equator as ~12,364 km²", () => {
    const box: BBox = [
      [0, 0],
      [1, 1],
    ];
    const area = bboxAreaKm2(box);
    expect(area).toBeGreaterThan(12_200);
    expect(area).toBeLessThan(12_500);
  });

  it("shrinks with latitude", () => {
    const equator = bboxAreaKm2([[0, 0], [1, 1]]);
    const nordic = bboxAreaKm2([[0, 60], [1, 61]]);
    expect(nordic).toBeLessThan(equator * 0.6);
  });

  it("handles antimeridian-crossing boxes", () => {
    const area = bboxAreaKm2([[179.5, 0], [-179.5, 1]]);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeCloseTo(bboxAreaKm2([[0, 0], [1, 1]]), 0);
  });
});

describe("recordAreaM2", () => {
  it("returns 0 when no bbox was stored", () => {
    expect(recordAreaM2(record({ bbox: null }))).toBe(0);
  });

  it("returns the footprint when a bbox exists", () => {
    const r = record({ bbox: [[-74, 40.7], [-73.99, 40.71]] });
    expect(recordAreaM2(r)).toBeGreaterThan(0);
  });
});

describe("analysesToGeoJSON", () => {
  it("emits a Polygon footprint when a bbox is stored", () => {
    const fc = analysesToGeoJSON([
      record({ bbox: [[-74, 40.7], [-73.9, 40.8]] }),
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0];
    expect(f.geometry.type).toBe("Polygon");
    // A closed ring: first and last positions identical.
    const ring = (f.geometry.coordinates as number[][][])[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(f.properties.absorption_score).toBe(28.5);
    expect(f.properties.flood_risk).toBe("high");
    expect(f.properties.area_km2).toBeGreaterThan(0);
  });

  it("falls back to a Point at the scan center without a bbox", () => {
    const fc = analysesToGeoJSON([record({ bbox: null })]);
    const f = fc.features[0];
    expect(f.geometry.type).toBe("Point");
    expect(f.geometry.coordinates).toEqual([-73.985, 40.758]);
    expect(f.properties.area_km2).toBeNull();
  });

  it("round-trips through JSON.stringify as valid GeoJSON keys", () => {
    const json = JSON.stringify(analysesToGeoJSON([record({})]));
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.features[0].type).toBe("Feature");
  });
});

describe("analysesToCSV", () => {
  it("produces a header plus one row per record", () => {
    const csv = analysesToCSV([record({}), record({ id: "def-456" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("id,name,location,absorption_score")).toBe(
      true
    );
    expect(lines[1]).toContain("abc-123");
    expect(lines[2]).toContain("def-456");
  });

  it("escapes fields containing commas and quotes", () => {
    const csv = analysesToCSV([
      record({ name: 'Pier 40, the "big" one' }),
    ]);
    expect(csv).toContain('"Pier 40, the ""big"" one"');
  });
});

describe("csvEscape", () => {
  it("passes plain values through and quotes risky ones", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape(12.5)).toBe("12.5");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });
});
