import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Milliseconds the press must be sustained. */
  durationMs: number;
  onComplete: () => void;
  disabled?: boolean;
}

/**
 * Press-and-hold, for pointer, touch, and keyboard alike.
 *
 * Progress is reported 0–1 so a caller can draw the hold; completion fires
 * once per press. Space and Enter hold the same way a finger does — the key
 * repeat is ignored so the timer starts on the first keydown only.
 */
export function usePressAndHold({ durationMs, onComplete, disabled }: Options) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = 0;
    done.current = false;
    setHolding(false);
    setProgress(0);
  }, []);

  const now = () => (typeof performance !== "undefined" && performance.now ? Date.now() : Date.now());

  const tick = useCallback(() => {
    const elapsed = Date.now() - startedAt.current;
    const p = Math.min(1, elapsed / durationMs);
    setProgress(p);
    if (p >= 1) {
      if (!done.current) {
        done.current = true;
        onCompleteRef.current();
      }
      cancel();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }, [cancel, durationMs]);

  const start = useCallback(() => {
    if (disabled || startedAt.current) return;
    done.current = false;
    startedAt.current = Date.now();
    setHolding(true);
    frame.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  useEffect(() => cancel, [cancel]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      // Left button / touch / pen only, and keep the browser from starting a
      // text selection or long-press menu over the number being held.
      if (e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      if (holding) e.preventDefault();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      if (e.repeat) return;
      e.preventDefault();
      start();
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") cancel();
    },
    onBlur: cancel,
  };

  return { progress, holding, handlers, cancel };
}