export type Recommendation = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "green" | "blue" | "gray";
};

export function parseRecommendations(raw: string): Recommendation[] {
  const json = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const payload = JSON.parse(json);
  if (!Array.isArray(payload?.recommendations) || payload.recommendations.length !== 4) {
    throw new Error("Expected four recommendations");
  }
  return payload.recommendations.map((item: Record<string, unknown>) => {
    if (
      typeof item?.title !== "string" || !item.title.trim() || item.title.length > 200 ||
      typeof item.description !== "string" || !item.description.trim() || item.description.length > 2000 ||
      !["high", "medium", "low"].includes(String(item.priority)) ||
      !["green", "blue", "gray"].includes(String(item.category))
    ) throw new Error("Invalid recommendation");
    return {
      title: item.title.trim(), description: item.description.trim(),
      priority: item.priority as Recommendation["priority"],
      category: item.category as Recommendation["category"],
    };
  });
}

/** Claude is used only for advice; classification and score computation stay unchanged. */
export async function generateRecommendations(options: {
  prompt: string;
  apiKey?: string;
  model: string;
  fallback: () => Promise<string>;
  fallbackProvider: string;
  fetcher?: typeof fetch;
}): Promise<{ recommendations: Recommendation[]; provider: string; model?: string }> {
  if (options.apiKey) {
    try {
      const response = await (options.fetcher ?? fetch)("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model, max_tokens: 1800,
          messages: [{ role: "user", content: options.prompt }],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      // Never log or return provider error bodies: they may contain sensitive data.
      if (!response.ok) throw new Error("Claude unavailable");
      const data = await response.json();
      const text = Array.isArray(data.content)
        ? data.content.filter((p: { type?: string }) => p.type === "text")
            .map((p: { text?: string }) => p.text ?? "").join("")
        : "";
      return { recommendations: parseRecommendations(text), provider: "anthropic", model: options.model };
    } catch {
      // Missing quota, invalid output or timeout must not discard a valid terrain scan.
    }
  }
  return {
    recommendations: parseRecommendations(await options.fallback()),
    provider: options.fallbackProvider,
  };
}