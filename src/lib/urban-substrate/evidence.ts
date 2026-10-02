import { sourceSummary } from "./provenance";
import type { SubstrateEvidence, SubstrateState } from "./identity";
import type { SubstrateView } from "./loader";

/** How a study uses the substrate in this version. Kept in every export. */
export const SUBSTRATE_USE =
  "Recorded as a controlled variable and as observed/reference context with provenance. In this version the D8 storm routing reads no substrate geometry, and nothing in the substrate replaces or adjusts the AI land-cover classification.";

export function substrateEvidence(state: SubstrateState, view: SubstrateView | null): SubstrateEvidence {
  if (state.status !== "loaded" || !view) {
    return { state, sources: [], layers: [], coverage: null, compiler: null, diagnostics: null, use: SUBSTRATE_USE };
  }
  const { manifest } = view;
  return {
    state,
    sources: manifest.sources.map(sourceSummary),
    layers: Object.values(manifest.layers).map((layer) => ({ id: layer.id, title: layer.title, evidence: layer.evidence, caveats: layer.caveats })),
    coverage: view.coverage,
    compiler: { name: manifest.compiler.name, version: manifest.compiler.version, configHash: manifest.compiler.configHash },
    diagnostics: { ...view.diagnostics },
    use: SUBSTRATE_USE,
  };
}
