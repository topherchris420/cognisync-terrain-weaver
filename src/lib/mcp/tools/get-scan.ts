import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_scan",
  title: "Get terrain scan",
  description:
    "Fetch one terrain scan by id, including land-cover breakdown, absorption score, flood risk and climate-adaptation recommendations.",
  inputSchema: { id: z.string().uuid().describe("The scan id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const { data, error } = await supabaseAnon()
      .from("analyses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No scan found with id ${id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { scan: data },
    };
  },
});