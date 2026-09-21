import { parseCatalystExperiment } from "./schema";
import type {
  CatalystExperiment,
  CatalystProvider,
  CatalystRequest,
  CatalystSiteContext,
} from "./types";

export class RemoteCatalystProvider implements CatalystProvider {
  constructor(private readonly apiUrl: string) {}

  async compileExperiment(
    context: CatalystSiteContext,
    request: CatalystRequest
  ): Promise<CatalystExperiment> {
    const response = await fetch(`${this.apiUrl.replace(/\/$/, "")}/api/catalyst/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, request }),
    });

    if (!response.ok) {
      throw new Error(`Catalyst service unavailable (${response.status})`);
    }

    return parseCatalystExperiment(await response.json());
  }
}
