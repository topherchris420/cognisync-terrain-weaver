import { ExternalLink, Leaf, MapPinOff } from "lucide-react";
import type { Welikia1609State } from "@/hooks/useWelikia1609";
import { BASELINE_SCORE } from "@/lib/baseline";

interface Historical1609PanelProps {
  state: Welikia1609State;
  /** The site's absorption score today, for the distance readout. */
  presentScore: number;
}

const CLASS_LABELS: Record<string, string> = {
  vegetation: "Forest, marsh & meadow",
  soil: "Beach, flat & outcrop",
  water: "Streams & ponds",
};

/**
 * What was actually here in 1609 — or an honest statement that nobody surveyed
 * it. The panel never falls back to the island-wide estimate silently: when the
 * reconstruction has no block for this ground it says so and labels the written
 * benchmark as modelled.
 */
export function Historical1609Panel({
  state,
  presentScore,
}: Historical1609PanelProps) {
  if (state.loading) {
    return (
      <div className="atlas-section">
        <p className="atlas-section-note">
          Reading the 1609 record for this ground…
        </p>
      </div>
    );
  }

  if (state.error || !state.lookup) {
    return (
      <div className="atlas-section space-y-1">
        <h3 className="atlas-section-title">
          This ground in 1609
        </h3>
        <p className="text-xs text-muted-foreground">
          {state.error ?? "The 1609 record could not be loaded."}
        </p>
      </div>
    );
  }

  const { lookup } = state;
  const source = lookup.source;

  if (lookup.status === "unavailable") {
    return (
      <div className="atlas-section space-y-3">
        <div className="flex items-center gap-2">
          <MapPinOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="atlas-section-title">
            This ground in 1609: not surveyed
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">{lookup.unavailableReason}</p>
        <p className="text-xs text-muted-foreground">
          The comparison above therefore uses the written Mannahatta benchmark of{" "}
          <span className="font-mono text-foreground">
            {BASELINE_SCORE.toFixed(0)}
          </span>{" "}
          — a modelled reference landscape, not an observation of this site.
        </p>
      </div>
    );
  }

  const cover = lookup.landCover!;
  const score = lookup.absorptionScore!;
  const delta = Math.round((score - presentScore) * 10) / 10;

  return (
    <div className="atlas-section space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="atlas-section-title">
            This ground in 1609
          </h3>
        </div>
        <span className="mt-1 shrink-0 font-mono text-[10px] text-muted-foreground">
          observed ·{" "}
          {lookup.blockCount.toLocaleString()}{" "}
          {lookup.blockCount === 1 ? "block" : "blocks"}
        </span>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="atlas-reading-number atlas-reading-number--sm">
            {score.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">
            Absorption in 1609
          </div>
        </div>
        {delta > 0 && (
          <div className="pb-5 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">
              −{delta.toFixed(0)}
            </span>{" "}
            points lost since
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {(["vegetation", "soil", "water"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{CLASS_LABELS[key]}</span>
              <span className="font-mono text-foreground">{cover[key]}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${cover[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {lookup.dominantCommunities.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Dominant here: {lookup.dominantCommunities.join(", ")}.
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {source.method} Source:{" "}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
        >
          {source.agency}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>{" "}
        · accessed {source.accessedAt}.
      </p>
    </div>
  );
}
