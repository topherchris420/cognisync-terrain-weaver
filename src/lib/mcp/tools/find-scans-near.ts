import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

const EARTH_KM_PER_DEG = 111.32;

export default defineTool({
  name: "find_scans_near",
  title: "Find scans near a location",
  description:
    "Find terrain scans whose map centre lies within a radius of the given latitude/longitude, sorted by distance.",
  inputSchema: {
    lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees."),
    lng: z.number().min(-180).max(180).describe("Longitude in decimal degrees."),
    radius_km: z.number().min(0.1).max(500).default(25).describe("Search radius in kilometres."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum scans to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lat, lng, radius_km, limit }) => {
    const radius = radius_km ?? 25;
    const latPad = radius / EARTH_KM_PER_DEG;
    const lngPad = radius / (EARTH_KM_PER_DEG * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

    const { data, error } = await supabaseAnon()
      .from("analyses")
      .select(
        "id,name,location_label,center_lat,center_lng,absorption_score,flood_risk,created_at",
      )
      .gte("center_lat", lat - latPad)
      .lte("center_lat", lat + latPad)
      .gte("center_lng", lng - lngPad)
      .lte("center_lng", lng + lngPad)
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const scans = (data ?? [])
      .map((row) => {
        const dLat = (row.center_lat - lat) * EARTH_KM_PER_DEG;
        const dLng =
          (row.center_lng - lng) * EARTH_KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
        return { ...row, distance_km: Math.round(Math.hypot(dLat, dLng) * 100) / 100 };
      })
      .filter((row) => row.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit ?? 10);

    return {
      content: [{ type: "text", text: JSON.stringify(scans, null, 2) }],
      structuredContent: { scans },
    };
  },
});