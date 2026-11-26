import { describe, expect, it, vi } from "vitest";
import { generateRecommendations } from "./recommendations";

const recommendations = Array.from({ length: 4 }, (_, i) => ({
  title: `Intervention ${i}`, description: "Site-specific advice", priority: "high", category: "green",
}));
const raw = JSON.stringify({ recommendations });
const fallback = () => Promise.resolve(raw);

describe("Claude recommendation routing", () => {
  it("uses Claude for recommendations when configured, without calling Gemini", async () => {
    const backup = vi.fn(fallback);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: raw }] })));
    const result = await generateRecommendations({ prompt: "Advice", apiKey: "test-only", model: "claude-sonnet-5", fallback: backup, fallbackProvider: "gemini", fetcher });
    expect(result.provider).toBe("anthropic");
    expect(result.recommendations).toEqual(recommendations);
    expect(backup).not.toHaveBeenCalled();
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).model).toBe("claude-sonnet-5");
  });
  it("keeps Gemini recommendations when no Claude key is configured", async () => {
    const fetcher = vi.fn();
    const result = await generateRecommendations({ prompt: "Advice", model: "claude-sonnet-5", fallback, fallbackProvider: "gemini", fetcher });
    expect(result.provider).toBe("gemini");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([429, 500])("falls back to Gemini on Claude HTTP %s", async (status) => {
    const result = await generateRecommendations({ prompt: "Advice", apiKey: "test-only", model: "claude-sonnet-5", fallback, fallbackProvider: "gemini", fetcher: async () => new Response("Unavailable", { status }) });
    expect(result.provider).toBe("gemini");
    expect(result.recommendations).toHaveLength(4);
  });
  it("falls back rather than storing malformed Claude advice", async () => {
    const result = await generateRecommendations({ prompt: "Advice", apiKey: "test-only", model: "claude-sonnet-5", fallback, fallbackProvider: "gemini", fetcher: async () => new Response(JSON.stringify({ content: [{ type: "text", text: '{"recommendations":[]}' }] })) });
    expect(result.provider).toBe("gemini");
    expect(result.recommendations).toEqual(recommendations);
  });
});