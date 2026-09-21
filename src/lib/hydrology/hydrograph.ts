/**
 * SCS-style triangular unit hydrograph for a uniform design storm.
 *
 * Time-to-peak is 40% of the rainfall duration. Recession continues to 1.67×
 * duration so the falling limb is longer than the rising limb. Discrete
 * ordinates are then scaled so ∫Q dt equals the routed runoff volume exactly.
 */
import type { HydrographPoint } from "./types";

export function designStormHydrograph(
  runoffM3: number,
  rainfallMm: number,
  durationMin: number,
  steps = 25
): HydrographPoint[] {
  const duration = Math.max(1, durationMin);
  const volume = Math.max(0, runoffM3);
  const rain = Math.max(0, rainfallMm);
  const tp = duration * 0.4;
  const tb = duration * 1.67;
  const count = Math.max(8, steps);
  const intensityMmPerHour = (rain / duration) * 60;
  const points: HydrographPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const tMin = (tb * i) / (count - 1);
    let shape = 0;
    if (tMin <= tp) {
      shape = tp > 0 ? tMin / tp : 1;
    } else if (tMin < tb) {
      shape = (tb - tMin) / (tb - tp);
    }
    points.push({
      tMin: Math.round(tMin * 10) / 10,
      qM3s: shape,
      rainMm: tMin <= duration ? intensityMmPerHour : 0,
    });
  }

  let integral = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dtSec = (points[i + 1].tMin - points[i].tMin) * 60;
    integral += 0.5 * (points[i].qM3s + points[i + 1].qM3s) * dtSec;
  }
  const scale = integral > 0 && volume > 0 ? volume / integral : 0;
  for (const point of points) {
    point.qM3s = Math.round(point.qM3s * scale * 1000) / 1000;
    point.rainMm = Math.round(point.rainMm * 1000) / 1000;
  }
  return points;
}

export function hydrographPeakM3s(points: HydrographPoint[]): number {
  return points.reduce((max, point) => Math.max(max, point.qM3s), 0);
}

export function hydrographVolumeM3(points: HydrographPoint[]): number {
  let volume = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dtSec = (points[i + 1].tMin - points[i].tMin) * 60;
    volume += 0.5 * (points[i].qM3s + points[i + 1].qM3s) * dtSec;
  }
  return volume;
}
