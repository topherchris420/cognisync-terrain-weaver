export type SensorOpticMode = "NORMAL" | "NVG" | "FLIR" | "CRT" | "NOIR" | "IR";

export interface OpticConfig {
  id: SensorOpticMode;
  label: string;
  shortcut: string;
  description: string;
  cssFilter: string;
  backdropFilter?: string;
  overlayClass: string;
  accentColor: string;
  gridColor: string;
  badge: string;
}

export const OPTIC_MODES: Record<SensorOpticMode, OpticConfig> = {
  NORMAL: {
    id: "NORMAL",
    label: "Standard RGB",
    shortcut: "1",
    description: "True-color natural satellite composite & reference cartography.",
    cssFilter: "none",
    overlayClass: "",
    accentColor: "rgb(59 130 246)", // blue-500
    gridColor: "rgba(59, 130, 246, 0.15)",
    badge: "RGB LIVE",
  },
  NVG: {
    id: "NVG",
    label: "Night Vision (NVG)",
    shortcut: "2",
    description: "Green phosphor image intensifier matrix with low-light amplification.",
    cssFilter: "hue-rotate(90deg) contrast(2.2) saturate(2.5) brightness(1.1)",
    backdropFilter: "brightness(1.2) contrast(1.8) hue-rotate(85deg)",
    overlayClass: "bg-emerald-950/20 mix-blend-color-dodge pointer-events-none",
    accentColor: "rgb(16 185 129)", // emerald-500
    gridColor: "rgba(16, 185, 129, 0.25)",
    badge: "NVG INTENSIFIED",
  },
  FLIR: {
    id: "FLIR",
    label: "Thermal FLIR (Ironbow)",
    shortcut: "3",
    description: "Forward-Looking Infrared false-color thermal heat distribution.",
    cssFilter: "hue-rotate(280deg) contrast(2.5) saturate(3) invert(0.15)",
    backdropFilter: "contrast(2.2) saturate(2.8) hue-rotate(240deg)",
    overlayClass: "bg-amber-950/20 mix-blend-overlay pointer-events-none",
    accentColor: "rgb(245 158 11)", // amber-500
    gridColor: "rgba(245, 158, 11, 0.25)",
    badge: "THERMAL FLIR",
  },
  CRT: {
    id: "CRT",
    label: "Tactical CRT Terminal",
    shortcut: "4",
    description: "High-density RGB scanlines with phosphor bloom & subtle curvature.",
    cssFilter: "contrast(1.4) brightness(1.05) saturate(1.3)",
    overlayClass: "crt-scanlines pointer-events-none",
    accentColor: "rgb(6 182 212)", // cyan-500
    gridColor: "rgba(6, 182, 212, 0.2)",
    badge: "CRT MONITOR",
  },
  NOIR: {
    id: "NOIR",
    label: "High-Contrast Monochrome",
    shortcut: "5",
    description: "Desaturated tactical reconnaissance image with enhanced dynamic range.",
    cssFilter: "grayscale(1) contrast(2.2) brightness(0.95)",
    overlayClass: "bg-slate-950/30 mix-blend-multiply pointer-events-none",
    accentColor: "rgb(248 113 113)", // red-400
    gridColor: "rgba(248, 113, 113, 0.2)",
    badge: "MONO RECON",
  },
  IR: {
    id: "IR",
    label: "False-Color Vegetation (IR)",
    shortcut: "6",
    description: "Near-infrared reflectance highlighting photosynthesizing canopy and runoff.",
    cssFilter: "hue-rotate(320deg) contrast(1.8) saturate(2.4)",
    overlayClass: "bg-fuchsia-950/15 mix-blend-color-burn pointer-events-none",
    accentColor: "rgb(217 70 239)", // fuchsia-500
    gridColor: "rgba(217, 70, 239, 0.2)",
    badge: "NIR SPECTRUM",
  },
};

/**
 * Converts latitude and longitude to a Maidenhead Grid Locator (e.g., FN30as).
 * Standard military & radio field positioning format used in GEV intelligence feeds.
 */
export function latLngToMaidenhead(lat: number, lng: number): string {
  const adjustedLng = lng + 180;
  const adjustedLat = lat + 90;

  const field1 = String.fromCharCode(65 + Math.floor(adjustedLng / 20));
  const field2 = String.fromCharCode(65 + Math.floor(adjustedLat / 10));

  const square1 = Math.floor((adjustedLng % 20) / 2);
  const square2 = Math.floor(adjustedLat % 10);

  const subsquare1 = String.fromCharCode(
    97 + Math.floor((adjustedLng % 2 - Math.floor((adjustedLng % 2) / 2) * 2) * 12)
  );
  const subsquare2 = String.fromCharCode(
    97 + Math.floor((adjustedLat % 1 - Math.floor(adjustedLat % 1)) * 24)
  );

  return `${field1}${field2}${square1}${square2}${subsquare1}${subsquare2}`;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      try {
        audioCtx = new AudioCtxClass();
      } catch {
        audioCtx = null;
      }
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTacticalSound(type: "click" | "switch" | "lock" | "alert" | "hum") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "switch") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "lock") {
      osc.type = "square";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1760, now + 0.05);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "alert") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "hum") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {
    // Graceful fallback if audio permissions are blocked or disabled
  }
}
