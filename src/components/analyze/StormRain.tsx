import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

interface StormRainProps {
  /** True while a storm is being routed. */
  raining: boolean;
  /** Design depth; heavier storms fall denser and faster. */
  rainfallMm: number;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

const MIN_MS = 2300;
const FADE_IN_MS = 380;
const FADE_OUT_MS = 900;
/** Slight wind shear, in x-pixels per y-pixel. */
const SHEAR = 0.16;

/**
 * Rain over the study area while the storm is routed. It never delays the
 * result: the storm resolves on its own clock, and the rain simply finishes
 * falling as the first flow paths appear beneath it.
 */
export function StormRain({ raining, rainfallMm }: StormRainProps) {
  const reduceMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ start: 0, stopAt: 0, running: false });
  const frameRef = useRef(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const rainingRef = useRef(raining);
  const depthRef = useRef(rainfallMm);
  rainingRef.current = raining;
  depthRef.current = rainfallMm;

  useEffect(() => {
    if (reduceMotion || !raining) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const state = stateRef.current;
    if (state.running) {
      state.stopAt = 0;
      return;
    }
    state.running = true;
    canvas.style.visibility = "visible";
    state.start = performance.now();
    state.stopAt = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    let last = state.start;

    const intensity = Math.max(0.35, Math.min(1.6, depthRef.current / 55));

    const spawn = (anywhere: boolean): Drop => ({
      x: Math.random() * (width + height * SHEAR) - height * SHEAR,
      y: anywhere ? Math.random() * height : -30 - Math.random() * 80,
      len: 14 + Math.random() * 22 * intensity,
      speed: (900 + Math.random() * 700) * (0.8 + intensity * 0.25),
      alpha: 0.32 + Math.random() * 0.45,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((width * height) / 2200) * intensity);
      drops = Array.from({ length: Math.min(1400, Math.max(140, count)) }, () => spawn(true));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observerRef.current = observer;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = now - state.start;

      if (!rainingRef.current && !state.stopAt) {
        state.stopAt = Math.max(now, state.start + MIN_MS - FADE_OUT_MS);
      }
      let envelope = Math.min(1, elapsed / FADE_IN_MS);
      if (state.stopAt) {
        const out = (now - state.stopAt) / FADE_OUT_MS;
        if (out >= 1) {
          ctx.clearRect(0, 0, width, height);
          canvas.style.visibility = "hidden";
          state.running = false;
          observer.disconnect();
          return;
        }
        envelope *= 1 - Math.max(0, out);
      }

      ctx.clearRect(0, 0, width, height);
      // Storm light: the ground darkens a touch under cloud.
      ctx.fillStyle = `rgba(4, 14, 18, ${0.3 * envelope})`;
      ctx.fillRect(0, 0, width, height);

      ctx.lineCap = "round";
      ctx.lineWidth = 1.25;
      for (const drop of drops) {
        drop.y += drop.speed * dt;
        drop.x += drop.speed * dt * SHEAR;
        if (drop.y - drop.len > height) Object.assign(drop, spawn(false));
        ctx.strokeStyle = `rgba(214, 244, 255, ${drop.alpha * envelope})`;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.len * SHEAR, drop.y - drop.len);
        ctx.stroke();
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    // No cleanup here: a finished storm lets the rain fade out on its own.
  }, [raining, reduceMotion]);

  useEffect(() => {
    const state = stateRef.current;
    return () => {
      cancelAnimationFrame(frameRef.current);
      observerRef.current?.disconnect();
      state.running = false;
    };
  }, []);

  if (reduceMotion) return null;
  return <canvas ref={canvasRef} className="atlas-rain" aria-hidden="true" />;
}
