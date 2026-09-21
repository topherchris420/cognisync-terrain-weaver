import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { CATALYST_REVEAL } from "@/lib/catalyst";

interface Props {
  open: boolean;
  onDone: () => void;
}

/**
 * The moment the layer opens: a gold contour moves out across the map, and
 * two sentences arrive in sequence. It dismisses itself; a click, a key, or
 * reduced-motion all shorten it. Nothing is interactive underneath, and
 * nothing is destroyed — the map is still there when it clears.
 */
export function CatalystReveal({ open, onDone }: Props) {
  const reduced = usePrefersReducedMotion();
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!open) {
      setLine(0);
      return;
    }
    if (reduced) {
      setLine(1);
      const t = window.setTimeout(onDone, 3600);
      return () => window.clearTimeout(t);
    }
    const second = window.setTimeout(() => setLine(1), 2300);
    const finish = window.setTimeout(onDone, 6200);
    return () => {
      window.clearTimeout(second);
      window.clearTimeout(finish);
    };
  }, [open, reduced, onDone]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 overflow-hidden bg-background/70 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      {!reduced && (
        <>
          <span className="catalyst-contour" aria-hidden="true" />
          <span
            className="catalyst-contour"
            style={{ animationDelay: "700ms" }}
            aria-hidden="true"
          />
          <span
            className="catalyst-contour"
            style={{ animationDelay: "1400ms" }}
            aria-hidden="true"
          />
        </>
      )}

      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 text-center">
        <div
          className="catalyst-rule w-40 animate-catalyst-rule"
          aria-hidden="true"
        />
        <p
          key={line}
          className={cn(
            "catalyst-serif mt-6 max-w-xl text-balance text-xl uppercase text-catalyst sm:text-2xl",
            !reduced && "animate-catalyst-rise"
          )}
        >
          {CATALYST_REVEAL[line]}
        </p>
        <div
          className="catalyst-rule mt-6 w-40 animate-catalyst-rule"
          aria-hidden="true"
        />
        <p className="catalyst-body mt-8 text-[11px] uppercase tracking-[0.35em] text-catalyst-muted">
          Catalyst
        </p>
      </div>
    </div>
  );
}