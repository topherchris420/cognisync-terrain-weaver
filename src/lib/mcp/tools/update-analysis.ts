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
  name: "update_analysis",
  title: "Update terrain scan",
  description:
    "Update a terrain scan owned by the signed-in user. Supplying a full land-cover mix recomputes the Urban Absorption Score and flood-risk band.",
  inputSchema: {
    id: z.string().uuid().describe("The scan id to update."),
    name: z.string().trim().min(1).optional(),
    location_label: z.string().trim().min(1).optional(),
    ai_notes: z.string().optional(),
    pavement: z.number().min(0).max(100).optional(),
    buildings: z.number().min(0).max(100).optional(),
    vegetation: z.number().min(0).max(100).optional(),
    water: z.number().min(0).max(100).optional(),
    soil: z.number().min(0).max(100).optional(),
    recommendations: z.array(recommendation).max(12).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to update a scan.");
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.location_label !== undefined) patch.location_label = input.location_label;
    if (input.ai_notes !== undefined) patch.ai_notes = input.ai_notes;
    if (input.recommendations !== undefined) patch.recommendations = input.recommendations;

    const cover = {
      pavement: input.pavement,
      buildings: input.buildings,
      vegetation: input.vegetation,
      water: input.water,
      soil: input.soil,
    };
    const given = Object.values(cover).filter((v) => v !== undefined).length;
    if (given > 0 && given < 5) {
      throw new ToolError(
        "Provide all five land-cover percentages (pavement, buildings, vegetation, water, soil) to change the mix.",
      );
    }
    if (given === 5) {
      const land_cover = cover as Record<keyof typeof cover, number>;
      const score = computeAbsorptionScore(land_cover);
      patch.land_cover = land_cover;
      patch.absorption_score = score;
      patch.flood_risk = classifyFloodRisk(score);
    }
    if (Object.keys(patch).length === 0) throw new ToolError("Nothing to update.");

    const { data, error } = await supabaseForUser(ctx)
      .from("analyses")
      .update(patch)
      .eq("id", input.id)
      .select()
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Scan not found, or it is not owned by you.");
    return {
      content: [{ type: "text", text: `Updated scan ${data.id}.` }],
      structuredContent: { scan: data },
    };
  },
});