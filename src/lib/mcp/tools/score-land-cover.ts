import { validateLandCover } from "../../../../supabase/functions/_shared/land-cover";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { classifyFloodRisk, computeAbsorptionScore } from "@/lib/absorption";

export default defineTool({
  name: "score_land_cover",
  title: "Score a land-cover mix",
  description:
    "Compute the Urban Absorption Score (0-100) and flood-risk band for a hypothetical land-cover mix. Percentages should sum to 100 within 0.5 percentage points.",
  inputSchema: {
    pavement: z.number().min(0).max(100).describe("Pavement percentage."),
    buildings: z.number().min(0).max(100).describe("Building rooftop percentage."),
    vegetation: z.number().min(0).max(100).describe("Vegetation percentage."),
    water: z.number().min(0).max(100).describe("Open water percentage."),
    soil: z.number().min(0).max(100).describe("Bare soil percentage."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (cover) => {
    validateLandCover(cover);
    const score = computeAbsorptionScore(cover);
    const risk = classifyFloodRisk(score);
    return {
      content: [
        {
          type: "text",
          text: `Urban Absorption Score: ${score}/100 — flood risk: ${risk}.`,
        },
      ],
      structuredContent: { absorption_score: score, flood_risk: risk },
    };
  },
});