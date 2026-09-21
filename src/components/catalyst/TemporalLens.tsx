import { cn } from "@/lib/utils";
import { EPOCHS, EPOCH_ORDER, type Epoch } from "@/lib/catalyst";

interface Props {
  epoch: Epoch;
  onChange: (epoch: Epoch) => void;
  /** Before the unlock the timeline stops at 2026. */
  unlocked: boolean;
  className?: string;
}

/**
 * The Temporal Lens — 1609 → 2026, and, once the layer is open, → +.
 *
 * It sits on the map rather than replacing it: moving through time should
 * never mean leaving the thing you are looking at. Arrow keys walk the
 * timeline, because a timeline that can only be clicked is a row of buttons.
 */
export function TemporalLens({ epoch, onChange, unlocked, className }: Props) {
  const stops = unlocked ? EPOCH_ORDER : EPOCH_ORDER.filter((e) => e !== "future");

  const step = (delta: number) => {
    const i = stops.indexOf(epoch);
    const next = stops[Math.min(stops.length - 1, Math.max(0, i + delta))];
    if (next && next !== epoch) onChange(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Temporal lens"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
      }}
      className={cn(
        "flex items-stretch gap-0 rounded-lg border bg-background/85 p-1 backdrop-blur transition-colors",
        unlocked ? "border-catalyst/35" : "border-border",
        className
      )}
    >
      {stops.map((id, i) => {
        const meta = EPOCHS[id];
        const active = epoch === id;
        const future = id === "future";
        return (
          <div key={id} className="flex items-stretch">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "my-auto h-px w-4 sm:w-6",
                  future ? "bg-catalyst/45" : "bg-border"
                )}
              />
            )}
            <button
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(id)}
              className={cn(
                "min-w-[70px] rounded-md px-3 py-1.5 text-left transition-colors",
                active
                  ? future
                    ? "bg-catalyst/15 text-catalyst"
                    : "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "block font-mono text-sm font-semibold leading-none",
                  future && "catalyst-serif text-base tracking-[0.2em]"
                )}
              >
                {meta.label}
              </span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] opacity-75">
                {meta.question}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}