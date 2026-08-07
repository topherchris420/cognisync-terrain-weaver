import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_scans",
  title: "List my terrain scans",
  description: "List terrain scans owned by the signed-in user, newest first.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to list your scans.");
    const { data, error } = await supabaseForUser(ctx)
      .from("analyses")
      .select("id,name,location_label,absorption_score,flood_risk,created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { scans: data ?? [] },
    };
  },
});