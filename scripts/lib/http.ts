/** Fetch with exponential backoff for opt-in data acquisition scripts (never used in CI). */
export async function fetchWithRetry(url: string, attempts = 4, init?: RequestInit): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
      if (response.ok) return response;
      last = new Error(`${response.status} ${url}`);
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw last;
}
