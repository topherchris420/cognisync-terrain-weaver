import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePressAndHold } from "@/hooks/use-press-and-hold";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { CATALYST_HOLD_MS } from "@/lib/catalyst";

interface Props {
  /** The figure that hides the door — rendered character by character. */
  text: string;
  unlocked: boolean;
  onUnlock: () => void;
  className?: string;
}

/**
 * The 1609 figure, which is also a latch.
 *
 * Held down — by mouse, finger, or the space bar — the number separates,
 * warms to gold, and opens the layer underneath. Released early, it closes
 * again with no trace. It carries no visible affordance on purpose: this is
 * meant to be discovered, not advertised. It stays reachable, though — it is
 * a real button with a real accessible name, so a screen-reader user can find
 * it exactly the way a curious one does.
 */
export function CatalystSigil({ text, unlocked, onUnlock, className }: Props) {
  const reduced = usePrefersReducedMotion();
  const [justFired, setJustFired] = useState(false);

  const { progress, holding, handlers } = usePressAndHold({
    durationMs: CATALYST_HOLD_MS,
    disabled: unlocked,
    onComplete: () => {
      setJustFired(true);
      onUnlock();
    },
  });

  const chars = [...text];
  const mid = (chars.length - 1) / 2;

  return (
    <span
      {...handlers}
      role="button"
      tabIndex={0}
      data-holding={holding || undefined}
      data-testid="catalyst-sigil"
      aria-label={
        unlocked
          ? `${text} — the 1609 benchmark. The Catalyst layer is open.`
          : `${text} — the 1609 benchmark. Press and hold to see what else this figure holds.`
      }
      className={cn(
        "catalyst-sigil select-none outline-none",
        (unlocked || justFired) && "text-catalyst/90",
        className
      )}
      style={{ touchAction: "none" }}
    >
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          aria-hidden="true"
          className="catalyst-sigil-char"
          style={
            reduced || !holding
              ? undefined
              : {
                  transform: `translateX(${(i - mid) * progress * 5}px) translateY(${
                    -Math.abs(i - mid) * progress * 1.5
                  }px)`,
                }
          }
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}