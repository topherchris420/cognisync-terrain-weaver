import { cn } from "@/lib/utils";
import { EPOCHS, type Epoch } from "@/lib/catalyst";

interface Props {
  epoch: Epoch;
  /** True once a future has actually been configured, not merely selected. */
  futureConfigured?: boolean;
}

/**
 * A veil over the imagery for any epoch that is not the present.
 *
 * Deliberately a wash, not a reconstruction. This app holds no 1609 geometry
 * for any block on Earth, and drawing invented forest onto a real street grid
 * would be a lie told beautifully. The veil says "you are not looking at now"
 * and the plate says exactly what you *are* looking at.
 */
export function EpochVeil({ epoch, futureConfigured }: Props) {
  if (epoch === "2026") return null;
  const meta = EPOCHS[epoch];
  const past = epoch === "1609";

  return (
    <>
      <div
        className={cn(
          "epoch-veil z-10",
          past ? "epoch-veil-past" : "epoch-veil-future"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-3 z-20 max-w-[19rem] rounded-lg border p-3 backdrop-blur",
          past
            ? "border-primary/30 bg-background/80"
            : "catalyst-plate border-catalyst/30"
        )}
      >
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              past ? "text-foreground" : "catalyst-serif text-catalyst"
            )}
          >
            {past ? "1609" : "Catalyst // possible futures"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {meta.provenance}
          </span>
        </div>
        <p className="catalyst-body mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {past
            ? "No per-block historical geometry is available, so none is drawn. What is shown is the benchmark, honestly labelled."
            : futureConfigured
            ? "The land cover below does not exist yet. Every figure is the live model applied to a counterfactual surface."
            : "The historical layer asks what was. Mannahatta describes what is. Catalyst asks what could be."}
        </p>
      </div>
    </>
  );
}