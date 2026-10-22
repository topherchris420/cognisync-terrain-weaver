import { describe, expect, it } from "vitest";
import {
  ERAS,
  NYC_EXTENT,
  NYC_ORTHO_HOST,
  eraCoversPoint,
  eraTileUrl,
  getEra,
  isPastEra,
} from "./eras";

const MIDTOWN: [number, number] = [-73.985, 40.758];
const PHILADELPHIA: [number, number] = [-75.16, 39.95];

const TIMELINE = [
  "1609",
  "1924",
  "1951",
  "1996",
  "2006",
  "2016",
  "2018",
  "today",
  "fp-2050",
  "fp-2080",
  "fp-2100",
  "slr-3ft",
];

describe("era timeline catalogue", () => {
  it("keeps every supported timeline entry, in order", () => {
    expect(ERAS.map((era) => era.id)).toEqual(TIMELINE);
  });

  it.each(ERAS.map((era) => [era.id, era] as const))(
    "%s names its publisher, provenance and limits",
    (_id, era) => {
      expect(era.agency.length).toBeGreaterThan(3);
      expect(["observed", "reconstruction", "projection"]).toContain(era.provenance);
      expect(era.limitations.length).toBeGreaterThan(0);
      expect(era.caption.length).toBeGreaterThan(10);
    }
  );

  it("never points at the retired maps.nyc.gov tile service", () => {
    for (const era of ERAS) {
      expect(era.tiles ?? "").not.toContain("maps.nyc.gov/xyz");
    }
  });

  it("uses a distinct tile service for every era", () => {
    const templates = ERAS.flatMap((era) => (era.tiles ? [era.tiles] : []));
    expect(new Set(templates).size).toBe(templates.length);
  });

  const aerials = ERAS.filter((era) => era.kind === "raster");

  it("covers the six aerial survey years", () => {
    expect(aerials.map((era) => era.year)).toEqual([1924, 1951, 1996, 2006, 2016, 2018]);
  });

  it.each(aerials.map((era) => [era.id, era] as const))(
    "%s reads the city service named for its own year, row-first",
    (_id, era) => {
      expect(era.tiles).toMatch(
        new RegExp(
          `^${NYC_ORTHO_HOST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(NYC_Orthos|Ortho)_${era.year}(_Mosaic)?/MapServer/tile/\\{z\\}/\\{y\\}/\\{x\\}$`
        )
      );
      expect(era.sourceUrl).toBe(era.tiles!.replace("/tile/{z}/{y}/{x}", ""));
      expect(era.attribution).toContain(String(era.year));
      expect(era.captured).toBeTruthy();
    }
  );

  it.each(aerials.map((era) => [era.id, era] as const))(
    "%s declares zoom and coverage the service actually caches",
    (_id, era) => {
      // Levels 0-20 are cached; 21 answers 404.
      expect(era.maxzoom).toBe(20);
      const [west, south, east, north] = era.bounds!;
      expect(west).toBeGreaterThanOrEqual(NYC_EXTENT.west);
      expect(south).toBeGreaterThanOrEqual(NYC_EXTENT.south);
      expect(east).toBeLessThanOrEqual(NYC_EXTENT.east);
      expect(north).toBeLessThanOrEqual(NYC_EXTENT.north);
      expect(eraCoversPoint(era, ...MIDTOWN)).toBe(true);
      expect(eraCoversPoint(era, ...PHILADELPHIA)).toBe(false);
    }
  );

  it("expands tile templates with ArcGIS row/column ordering", () => {
    const era = getEra("1924");
    expect(eraTileUrl(era, 16, 19299, 24629)).toBe(
      `${NYC_ORTHO_HOST}/Ortho_1924_Mosaic/MapServer/tile/16/24629/19299`
    );
    expect(eraTileUrl(getEra("1609"), 14, 4824, 6157)).toMatch(/\/14\/4824\/6157\.png$/);
    expect(eraTileUrl(getEra("today"), 1, 1, 1)).toBeNull();
  });

  it("separates scholarly reconstruction, observation and projection", () => {
    expect(getEra("1609").provenance).toBe("reconstruction");
    for (const id of ["fp-2050", "fp-2080", "fp-2100", "slr-3ft"]) {
      expect(getEra(id).provenance).toBe("projection");
    }
    for (const era of aerials) expect(era.provenance).toBe("observed");
  });

  it("hides today's 3D buildings from every view of the past", () => {
    for (const era of ERAS) {
      const past = era.year < 2020 && era.kind !== "live";
      expect(era.presentDayBuildings).toBe(!past);
      expect(isPastEra(era)).toBe(past);
    }
    expect(getEra("today").presentDayBuildings).toBe(true);
  });

  it("tells the 3D view the historical imagery is draped, not reconstructed", () => {
    for (const era of ERAS.filter(isPastEra)) {
      expect(era.limitations.join(" ")).toMatch(/today's elevation model/);
    }
  });

  it("falls back to today for an unknown id", () => {
    expect(getEra("1066").id).toBe("today");
  });
});
