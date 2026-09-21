import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useCatalystUnlock } from "@/hooks/useCatalystUnlock";
import { cn } from "@/lib/utils";

interface CatalystUnlockProps {
  baselineScore: number;
  onUnlock?: () => void;
  className?: string;
}

const HOLD_MS = 1900;

export function CatalystUnlock({
  baselineScore,
  onUnlock,
  className,
}: CatalystUnlockProps) {
  const { isUnlocked, unlock } = useCatalystUnlock();
  const reducedMotion = usePrefersReducedMotion();
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const unlockedRef = useRef(isUnlocked);
  unlockedRef.current = isUnlocked;

  const complete = () => {
    if (unlockedRef.current) return;
    unlock();
    onUnlock?.();
  };

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  };

  const begin = () => {
    if (unlockedRef.current || timerRef.current !== null) return;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setHolding(false);
      complete();
    }, HOLD_MS);
  };

  useEffect(() => clear, []);

  const digits = baselineScore.toFixed(1).split("");

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onPointerDown={begin}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onKeyDown={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          begin();
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          clear();
        }}
        aria-label="Unlock Catalyst temporal lens by holding the historical baseline score"
        aria-pressed={holding || isUnlocked}
        className={cn(
          "group relative rounded-md px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors",
          "hover:text-warning focus-visible:text-warning",
          (holding || isUnlocked) && "text-warning"
        )}
      >
        <span className="sr-only">Estimated historical baseline score </span>
        <span aria-hidden="true">est. </span>
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex tabular-nums transition-[gap,letter-spacing]",
            !reducedMotion && (holding || isUnlocked) ? "gap-1.5" : "gap-0"
          )}
          style={{ transitionDuration: "1900ms" }}
        >
          {digits.map((digit, index) => (
            <span key={`${digit}-${index}`}>{digit}</span>
          ))}
        </span>
        <span aria-hidden="true"> before the city</span>
        {holding && (
          <span
            aria-hidden="true"
            className="absolute inset-x-1 -bottom-0.5 h-px origin-left bg-warning motion-reduce:animate-none"
            style={{
              animation: reducedMotion
                ? undefined
                : `catalyst-hold ${HOLD_MS}ms linear forwards`,
            }}
          />
        )}
      </button>

      {isUnlocked && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-warning">
          THE HISTORICAL LAYER
          <br />
          IS NOT THE LAST LAYER.
        </p>
      )}
    </div>
  );
}
