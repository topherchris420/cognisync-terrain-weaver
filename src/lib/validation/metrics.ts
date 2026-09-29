import { mulberry32 } from "./study-areas";

/** Plain descriptive statistics. Every function rejects empty input explicitly. */

function nonEmpty(values: number[], name: string): number[] {
  if (values.length === 0) throw new Error(`${name} requires at least one value.`);
  if (values.some((v) => !Number.isFinite(v))) throw new Error(`${name} requires finite values.`);
  return values;
}

export function mean(values: number[]): number {
  return nonEmpty(values, "mean").reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n − 1). Zero for a single value. */
export function sd(values: number[]): number {
  nonEmpty(values, "sd");
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

export function range(values: number[]): { min: number; max: number; span: number } {
  nonEmpty(values, "range");
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, span: max - min };
}

export function quantile(values: number[], q: number): number {
  const sorted = [...nonEmpty(values, "quantile")].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Signed mean error (model − reference): the systematic bias. */
export function bias(model: number[], reference: number[]): number {
  return mean(model.map((m, i) => m - reference[i]));
}

export function mae(model: number[], reference: number[]): number {
  return mean(model.map((m, i) => Math.abs(m - reference[i])));
}

export function rmse(model: number[], reference: number[]): number {
  return Math.sqrt(mean(model.map((m, i) => (m - reference[i]) ** 2)));
}

/**
 * Mid-rank percentile of `value` within `population` (0–1): the probability a
 * random member ranks below it, ties counted half. Averaging this over
 * positives gives the Mann–Whitney AUC against that population.
 */
export function midRankPercentile(value: number, population: number[]): number {
  nonEmpty(population, "midRankPercentile");
  let below = 0;
  let equal = 0;
  for (const other of population) {
    if (other < value) below += 1;
    else if (other === value) equal += 1;
  }
  return (below + equal / 2) / population.length;
}

/** Share of values that are integer multiples of `step` (within float noise). */
export function shareOnMultiple(values: number[], step: number): number {
  nonEmpty(values, "shareOnMultiple");
  return values.filter((v) => Math.abs(v / step - Math.round(v / step)) < 1e-9).length / values.length;
}

/**
 * Percentile bootstrap over clusters (e.g. study areas), seeded so CI and
 * every machine reproduce the same interval. Resampling whole clusters keeps
 * spatially correlated observations together instead of pretending they are
 * independent.
 */
export function clusterBootstrap<T>(
  clusters: T[][],
  statistic: (items: T[]) => number,
  { replicates = 2000, seed = 1609, level = 0.95 } = {},
): { estimate: number; lower: number; upper: number; replicates: number; level: number } {
  const populated = clusters.filter((c) => c.length > 0);
  if (populated.length === 0) throw new Error("clusterBootstrap requires observations.");
  const random = mulberry32(seed);
  const draws: number[] = [];
  for (let r = 0; r < replicates; r += 1) {
    const sample: T[] = [];
    for (let i = 0; i < populated.length; i += 1) {
      sample.push(...populated[Math.floor(random() * populated.length)]);
    }
    draws.push(statistic(sample));
  }
  const alpha = (1 - level) / 2;
  return {
    estimate: statistic(populated.flat()),
    lower: quantile(draws, alpha),
    upper: quantile(draws, 1 - alpha),
    replicates,
    level,
  };
}

/** Round for reports without losing sign or turning −0 into noise. */
export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Mid-ranks (1-based), ties share their average rank. */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) out[order[k][1]] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation with tie-corrected mid-ranks. */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 3) throw new Error("spearman requires two equal-length samples of at least 3.");
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

/** Jaccard overlap of the top `share` of cells by value in two aligned grids. */
export function topShareOverlap(a: number[], b: number[], share = 0.1): number {
  const k = Math.max(1, Math.round(a.length * share));
  const top = (values: number[]) => new Set(values.map((v, i) => [v, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]).slice(0, k).map(([, i]) => i));
  const ta = top(a);
  const tb = top(b);
  let both = 0;
  for (const i of ta) if (tb.has(i)) both += 1;
  return both / (ta.size + tb.size - both);
}
