import { useId, useMemo } from "react";
import type { UrbanSubstrateStatus } from "@/hooks/useUrbanSubstrate";
import { EVIDENCE_META, type EvidenceStatus } from "@/lib/evidence/status";
import { shortHash } from "@/lib/urban-substrate/manifest";
import { studySummary } from "@/lib/urban-substrate/loader";

const REASON: Record<string, string> = {
  "outside-coverage": "No compiled substrate covers this place yet.",
  "load-failed": "The substrate could not be loaded.",
  "integrity-failed": "A substrate tile did not match its recorded hash, so none of it is used.",
  "no-substrate-published": "No substrate is published.",
};

const kib = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString("en-US")} KiB`;

/**
 * "Urban substrate": the compiled public-record city state beneath the study.
 * Collapsed by default; provenance and diagnostics are one click deeper.
 */
export function UrbanSubstratePanel({ status, showOnMap, onShowOnMap }: { status: UrbanSubstrateStatus; showOnMap?: boolean; onShowOnMap?: (show: boolean) => void }) {
  const id = useId();
  const ready = status.phase === "ready" ? status : null;
  const summary = useMemo(() => (ready ? studySummary(ready.view) : null), [ready]);
  const headline =
    status.phase === "idle"
      ? "Not loaded"
      : status.phase === "loading"
        ? "Loading…"
        : status.phase === "unavailable"
          ? REASON[status.state.reason] ?? status.state.detail
          : `${ready!.view.manifest.substrateVersion} · ${ready!.view.diagnostics.localTiles + ready!.view.diagnostics.closureTiles} local + ${ready!.view.diagnostics.contextTiles} context tiles`;

  return (
    <section className="atlas-section" aria-labelledby={`${id}-title`}>
      <details className="atlas-substrate">
        <summary>
          <span id={`${id}-title`} className="atlas-section-title">Urban substrate</span>
          <span className="atlas-section-note block">{headline}</span>
        </summary>

        {status.phase === "unavailable" && (
          <p className="atlas-section-note mt-3">
            Storm runs and exports record this state ({status.state.reason}), so a comparison can never pair runs made with and
            without a substrate.
          </p>
        )}

        {ready && summary && (
          <>
            <p className="atlas-section-note mt-3">
              City structure compiled from public records into versioned tiles. Every storm run records exactly which tiles it was
              made with. The routing does not read this geometry yet, and nothing here changes the AI land cover.
            </p>
            <dl className="atlas-ledger mt-3" aria-label="Substrate identity">
              <div><dt>Version</dt><dd>{ready.view.manifest.substrateVersion}</dd></div>
              <div><dt>Coverage</dt><dd>{ready.view.coverage.status} ({Math.round(ready.view.coverage.fraction * 100)}% of the study)</dd></div>
              <div><dt>Loaded tiles</dt><dd>{ready.view.diagnostics.localTiles} local · {ready.view.diagnostics.closureTiles} closure · {ready.view.diagnostics.contextTiles} context</dd></div>
              <div><dt>Compiler</dt><dd>{ready.view.manifest.compiler.version}</dd></div>
              <div><dt>Manifest</dt><dd title={ready.view.manifest.hashes.manifest}>{shortHash(ready.view.manifest.hashes.manifest)}</dd></div>
            </dl>

            <h4 className="atlas-know-question mt-4">In this study extent</h4>
            <dl className="atlas-ledger" aria-label="Substrate facts for the study extent">
              <div><dt>Building footprints <small>(measured)</small></dt><dd>{summary.buildings.toLocaleString("en-US")} · {summary.footprintM2.toLocaleString("en-US")} m²</dd></div>
              <div><dt>Roof height recorded</dt><dd>{summary.buildingsWithHeight} of {summary.buildings}</dd></div>
              <div><dt>Street segments <small>(measured)</small></dt><dd>{summary.streets} · width known for {summary.streetsWithWidth}</dd></div>
              <div><dt>Street trees, 2015 <small>(measured)</small></dt><dd>{summary.trees}</dd></div>
              <div><dt>Open water <small>(modeled from shoreline)</small></dt><dd>{summary.openWaterShare === null ? "—" : `${Math.round(summary.openWaterShare * 100)}%`}</dd></div>
            </dl>

            <details className="mt-3 text-xs">
              <summary className="cursor-pointer">Evidence status by layer</summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {Object.values(ready.view.manifest.layers).map((layer) => (
                  <li key={layer.id}>
                    <strong className="text-foreground">{layer.title}</strong> · <span title={EVIDENCE_META[layer.evidence as EvidenceStatus]?.means}>{EVIDENCE_META[layer.evidence as EvidenceStatus]?.label ?? layer.evidence}</span>
                    {layer.caveats[0] ? ` — ${layer.caveats[0]}` : ""}
                  </li>
                ))}
              </ul>
            </details>

            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Source datasets ({ready.view.manifest.sources.length})</summary>
              <ul className="mt-2 space-y-2 text-muted-foreground">
                {ready.view.manifest.sources.map((source) => (
                  <li key={source.sourceId}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-foreground underline-offset-2 hover:underline">{source.title}</a>
                    <span className="block">
                      {source.provider}
                      {source.datasetId ? ` · ${source.datasetId}` : ""} · {EVIDENCE_META[source.evidence]?.label ?? source.evidence} · retrieved {source.retrievedAt.slice(0, 10)}
                      {source.datasetVersion ? ` · ${source.datasetVersion}` : ""}
                    </span>
                    <span className="block">{source.license}</span>
                  </li>
                ))}
              </ul>
            </details>

            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Diagnostics</summary>
              <dl className="atlas-ledger mt-2" aria-label="Substrate diagnostics">
                <div><dt>Tile bytes</dt><dd>{kib(ready.view.diagnostics.tileBytes)}</dd></div>
                <div><dt>Load time</dt><dd>{ready.view.diagnostics.loadMs} ms</dd></div>
                <div><dt>Features · vertices</dt><dd>{ready.view.diagnostics.features.toLocaleString("en-US")} · {ready.view.diagnostics.vertices.toLocaleString("en-US")}</dd></div>
                <div><dt>Memory (rough floor)</dt><dd>{kib(ready.view.diagnostics.memoryEstimateBytes)}</dd></div>
                {ready.view.diagnostics.jsHeapBytes !== null && <div><dt>JS heap (browser)</dt><dd>{kib(ready.view.diagnostics.jsHeapBytes)}</dd></div>}
                <div><dt>Identity</dt><dd title={ready.state.identityHash}>{shortHash(ready.state.identityHash)}</dd></div>
              </dl>
            </details>

            {onShowOnMap && (
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={Boolean(showOnMap)} onChange={(event) => onShowOnMap(event.target.checked)} className="accent-primary" />
                Show substrate footprints and streets on the map
              </label>
            )}
          </>
        )}
      </details>
    </section>
  );
}
