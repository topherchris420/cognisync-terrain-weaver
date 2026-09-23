import type { Map as MLMap } from "maplibre-gl";
import {
  TERRARIUM_SOURCE_ID,
  autoTerrainExaggeration,
  metersPerPixel,
  terrainExaggerationForZoom,
} from "@/lib/terrain-scene";

/** Mesh scale the ground rises from when 3D turns on. Zero would lose the DEM. */
export const RELIEF_RISE_FROM = 0.05;
const RISE_MS = 1700;
const RETARGET_MS = 950;
const SINK_MS = 650;
/** Give the tilt a head start so the ground visibly rises after it. */
const RISE_DELAY_MS = 260;
/** Stop waiting for DEM tiles and rise on the zoom estimate instead. */
const DEM_WAIT_MS = 1400;
/** Auto changes smaller than this are not worth moving the ground for. */
const AUTO_HYSTERESIS = 0.12;
const SAMPLE_GRID = 11;

interface LiveTerrain {
  exaggeration: number;
}

function liveTerrain(map: MLMap): LiveTerrain | null {
  const terrain = (map as unknown as { terrain?: LiveTerrain | null }).terrain;
  return terrain && typeof terrain.exaggeration === "number" ? terrain : null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * DEM meters on a grid around the view center, one view-width across.
 * Empty until mesh tiles are loaded: MapLibre reports unloaded ground as 0,
 * which is indistinguishable from real sea level.
 */
export function sampleViewElevations(map: MLMap): {
  elevations: number[];
  spanMeters: number;
} {
  const live = liveTerrain(map);
  if (
    !live ||
    !(live.exaggeration > 0) ||
    typeof map.queryTerrainElevation !== "function"
  ) {
    return { elevations: [], spanMeters: 0 };
  }
  if (typeof map.isSourceLoaded === "function" && !map.isSourceLoaded(TERRARIUM_SOURCE_ID)) {
    return { elevations: [], spanMeters: 0 };
  }
  const center = map.getCenter();
  const width =
    (typeof map.getContainer === "function" && map.getContainer()?.clientWidth) || 1024;
  const spanMeters = width * metersPerPixel(center.lat, map.getZoom());
  const dLat = spanMeters / 111_320;
  const dLng = dLat / Math.max(0.05, Math.cos((center.lat * Math.PI) / 180));
  const elevations: number[] = [];
  for (let row = 0; row < SAMPLE_GRID; row += 1) {
    for (let col = 0; col < SAMPLE_GRID; col += 1) {
      const u = col / (SAMPLE_GRID - 1) - 0.5;
      const v = row / (SAMPLE_GRID - 1) - 0.5;
      const value = map.queryTerrainElevation([
        center.lng + u * dLng,
        center.lat + v * dLat,
      ]);
      if (typeof value === "number" && Number.isFinite(value)) {
        elevations.push(value / live.exaggeration);
      }
    }
  }
  return { elevations, spanMeters };
}

export interface TerrainReliefOptions {
  /** Called with the committed mesh scale once each move settles. */
  onSettle?: (exaggeration: number) => void;
}

/**
 * Owns the terrain mesh scale while 3D is on: the ground rising when relief
 * is switched on, sinking when it is switched off, easing between presets,
 * and following the local relief in Auto.
 *
 * Frames write MapLibre's live terrain scale directly. `setTerrain` rebuilds
 * the draped render targets, so it runs once when a move settles.
 */
export class TerrainRelief {
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tween: {
    from: number;
    to: number;
    start: number;
    duration: number;
    done?: () => void;
  } | null = null;
  private explicit: number | undefined;
  private target: number | null = null;
  private active = false;
  private waitingForDem: (() => void) | null = null;

  constructor(
    private readonly map: MLMap,
    private readonly options: TerrainReliefOptions = {}
  ) {}

  /** The scale the mesh is drawn at right now, mid-animation included. */
  get value(): number | null {
    return liveTerrain(this.map)?.exaggeration ?? null;
  }

  /** Where the mesh is heading: the scale to restore after a style reload. */
  get settledValue(): number | null {
    return this.target ?? this.value;
  }

  /**
   * Relief was just switched on with the mesh at `RELIEF_RISE_FROM`.
   * Waits for the first DEM tiles so Auto can measure the ground, then rises.
   */
  rise(explicit: number | undefined) {
    this.cancel();
    this.explicit = explicit;
    this.active = true;
    this.bindIdle();
    const reduced = prefersReducedMotion();

    const start = () => {
      this.clearDemWait();
      this.animateTo(this.resolveTarget(), reduced ? 0 : RISE_MS);
    };

    if (reduced || typeof this.map.on !== "function") {
      start();
      return;
    }
    this.timer = setTimeout(() => {
      if (this.demReady()) {
        start();
        return;
      }
      const onData = () => {
        if (this.demReady()) start();
      };
      this.waitingForDem = () => this.map.off("sourcedata", onData);
      this.map.on("sourcedata", onData);
      this.timer = setTimeout(start, DEM_WAIT_MS);
    }, RISE_DELAY_MS);
  }

  /** A preset changed while relief is on. */
  retarget(explicit: number | undefined) {
    this.explicit = explicit;
    this.active = true;
    this.bindIdle();
    this.clearDemWait();
    this.animateTo(this.resolveTarget(), prefersReducedMotion() ? 0 : RETARGET_MS);
  }

  /** Lower the ground, then hand back to the caller to drop the mesh. */
  sink(done: () => void) {
    this.cancel();
    this.active = false;
    this.unbindIdle();
    if (!liveTerrain(this.map) || prefersReducedMotion()) {
      done();
      return;
    }
    this.animateTo(RELIEF_RISE_FROM, SINK_MS, done, false);
  }

  dispose() {
    this.cancel();
    this.active = false;
    this.unbindIdle();
  }

  private demReady(): boolean {
    return sampleViewElevations(this.map).elevations.length > 0;
  }

  private resolveTarget(): number {
    if (this.explicit !== undefined) return this.explicit;
    const { elevations, spanMeters } = sampleViewElevations(this.map);
    return (
      autoTerrainExaggeration(elevations, spanMeters) ??
      terrainExaggerationForZoom(this.map.getZoom())
    );
  }

  private readonly onIdle = () => {
    if (!this.active || this.explicit !== undefined || this.frame) return;
    const { elevations, spanMeters } = sampleViewElevations(this.map);
    const next = autoTerrainExaggeration(elevations, spanMeters);
    const current = this.target ?? this.value;
    if (next === null || current === null) return;
    if (Math.abs(next - current) / current < AUTO_HYSTERESIS) return;
    this.animateTo(next, prefersReducedMotion() ? 0 : RETARGET_MS);
  };

  private bindIdle() {
    if (typeof this.map.on !== "function") return;
    this.map.off?.("idle", this.onIdle);
    this.map.on("idle", this.onIdle);
  }

  private unbindIdle() {
    this.map.off?.("idle", this.onIdle);
  }

  private clearDemWait() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.waitingForDem?.();
    this.waitingForDem = null;
  }

  private cancel() {
    this.clearDemWait();
    if (this.frame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.frame);
    }
    this.frame = 0;
    this.tween = null;
  }

  private animateTo(
    to: number,
    duration: number,
    done?: () => void,
    commit = true
  ) {
    const live = liveTerrain(this.map);
    this.target = commit ? to : null;
    if (!live || duration <= 0 || typeof requestAnimationFrame !== "function") {
      this.cancel();
      if (commit) this.commit(to);
      done?.();
      return;
    }
    this.tween = {
      from: live.exaggeration,
      to,
      start: performance.now(),
      duration,
      done: commit ? () => this.commit(to) : done,
    };
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = () => {
    this.frame = 0;
    const tween = this.tween;
    const live = liveTerrain(this.map);
    if (!tween || !live) {
      this.tween = null;
      return;
    }
    const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
    live.exaggeration = tween.from + (tween.to - tween.from) * easeInOutCubic(t);
    this.map.triggerRepaint();
    if (t < 1) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    this.tween = null;
    tween.done?.();
  };

  private commit(exaggeration: number) {
    if (!this.active || typeof this.map.setTerrain !== "function") return;
    this.map.setTerrain({ source: TERRARIUM_SOURCE_ID, exaggeration });
    this.options.onSettle?.(exaggeration);
  }
}
