import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_scans",
  title: "List terrain scans",
  description:
    "List recent urban terrain scans with their Urban Absorption Score and flood-risk band, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many scans to return."),
    flood_risk: z
      .enum(["low", "moderate", "high"])
      .optional()
      .describe("Optional filter by flood-risk band."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, flood_risk }) => {
    let query = supabaseAnon()
      .from("analyses")
      .select(
        "id,name,location_label,center_lat,center_lng,absorption_score,flood_risk,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (flood_risk) query = query.eq("flood_risk", flood_risk);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { scans: data ?? [] },
    };
  },
});