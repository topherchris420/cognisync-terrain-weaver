import { describe, expect, it } from "vitest";
import { nycPhotoLayer } from "./eras";

describe("nycPhotoLayer", () => {
  it("requests the City's keyed TMS service, not the retired maps.nyc.gov tiles", () => {
    const layer = nycPhotoLayer(1924, "abc123");
    expect(layer.tiles).toBe(
      "https://api.nyc.gov/geoserver/gwc/service/tms/1.0.0/photo%3A1924@EPSG%3A900913@png8/{z}/{x}/{y}.png8?Key=abc123"
    );
    expect(layer.scheme).toBe("tms");
    expect(layer.unavailableReason).toBeUndefined();
  });

  it("draws nothing and says why when no key is set", () => {
    for (const key of [undefined, "", "   "]) {
      const layer = nycPhotoLayer(1951, key);
      expect(layer.tiles).toBeUndefined();
      expect(layer.unavailableReason).toMatch(/API key/);
    }
  });
});
