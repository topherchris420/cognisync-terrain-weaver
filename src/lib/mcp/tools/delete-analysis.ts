import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_analysis",
  title: "Delete terrain scan",
  description: "Permanently delete a terrain scan owned by the signed-in user.",
  inputSchema: { id: z.string().uuid().describe("The scan id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to delete a scan.");
    const { data, error } = await supabaseForUser(ctx)
      .from("analyses")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Scan not found, or it is not owned by you.");
    return {
      content: [{ type: "text", text: `Deleted scan ${id}.` }],
      structuredContent: { deleted_id: id },
    };
  },
});