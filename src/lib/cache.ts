interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class AnalysisCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(
    private maxSize: number = 100,
    private ttlMs: number = 3_600_000 // default 1 hour
  ) {}

  generateKey(lat: number, lng: number, zoom: number, params?: Record<string, unknown>): string {
    const latFixed = lat.toFixed(6);
    const lngFixed = lng.toFixed(6);
    const pStr = params ? JSON.stringify(params) : "";
    return `${latFixed}:${lngFixed}:${zoom}:${pStr}`;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
