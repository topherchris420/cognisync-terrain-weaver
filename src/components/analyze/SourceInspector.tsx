import type { SpatialFeatureInspection } from "@/lib/spatial-data/types";

interface SourceInspectorProps {
  inspection: SpatialFeatureInspection | null;
}

export function SourceInspector({ inspection }: SourceInspectorProps) {
  if (!inspection) return null;

  return (
    <aside
      aria-label="Spatial source inspector"
      className="rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Spatial evidence
      </p>
      <h3 className="mt-1 text-sm font-semibold">{inspection.surfaceClass}</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Source</dt>
        <dd>{inspection.agency}</dd>
        <dt className="text-muted-foreground">Observed</dt>
        <dd>{inspection.observedAt ?? "Not published at layer level"}</dd>
        <dt className="text-muted-foreground">Confidence</dt>
        <dd>{inspection.confidence}</dd>
        <dt className="text-muted-foreground">Availability</dt>
        <dd>{inspection.availability}</dd>
        <dt className="text-muted-foreground">Geometry</dt>
        <dd>{inspection.geometryStatus}</dd>
        <dt className="text-muted-foreground">Method</dt>
        <dd>{inspection.processingMethod}</dd>
        <dt className="text-muted-foreground">Affected metrics</dt>
        <dd>{inspection.affectedMetrics.join(", ")}</dd>
      </dl>
      {inspection.caveats.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {inspection.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      )}
      {inspection.officialUrl && (
        <a
          className="mt-3 inline-flex text-xs text-primary underline-offset-4 hover:underline"
          href={inspection.officialUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open official source
        </a>
      )}
    </aside>
  );
}
