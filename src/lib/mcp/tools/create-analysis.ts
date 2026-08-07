import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { classifyFloodRisk, computeAbsorptionScore } from "@/lib/absorption";

const recommendation = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  category: z.enum(["green", "blue", "gray"]).default("green"),
});

export default defineTool({
  name: "create_analysis",
  title: "Create terrain scan",
  description:
    "Store a new terrain scan owned by the signed-in user. Provide the land-cover mix in percentages; the Urban Absorption Score and flood-risk band are computed server-side unless explicitly overridden.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Human-readable name for the scan."),
    center_lat: z.number().min(-90).max(90).describe("Latitude of the scan centre."),
    center_lng: z.number().min(-180).max(180).describe("Longitude of the scan centre."),
    zoom: z.number().min(0).max(24).default(15).describe("Map zoom level of the scan frame."),
    location_label: z.string().trim().min(1).optional().describe("Optional place label."),
    pavement: z.number().min(0).max(100).describe("Pavement percentage."),
    buildings: z.number().min(0).max(100).describe("Building rooftop percentage."),
    vegetation: z.number().min(0).max(100).describe("Vegetation percentage."),
    water: z.number().min(0).max(100).describe("Open water percentage."),
    soil: z.number().min(0).max(100).describe("Bare soil percentage."),
    recommendations: z
      .array(recommendation)
      .max(12)
      .optional()
      .describe("Optional climate-adaptation interventions to store with the scan."),
    ai_notes: z.string().optional().describe("Optional analyst or model notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to create a scan.");
    const land_cover = {
      pavement: input.pavement,
      buildings: input.buildings,
      vegetation: input.vegetation,
      water: input.water,
      soil: input.soil,
    };
    const absorption_score = computeAbsorptionScore(land_cover);
    const flood_risk = classifyFloodRisk(absorption_score);

    const { data, error } = await supabaseForUser(ctx)
      .from("analyses")
      .insert({
        user_id: ctx.getUserId(),
        name: input.name,
        location_label: input.location_label ?? null,
        center_lat: input.center_lat,
        center_lng: input.center_lng,
        zoom: input.zoom,
        land_cover,
        absorption_score,
        flood_risk,
        recommendations: input.recommendations ?? [],
        ai_notes: input.ai_notes ?? null,
        status: "complete",
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return {
      content: [
        {
          type: "text",
          text: `Created scan "${data.name}" (${data.id}) — absorption ${absorption_score}/100, flood risk ${flood_risk}.`,
        },
      ],
      structuredContent: { scan: data },
    };
  },
});