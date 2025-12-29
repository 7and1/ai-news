/**
 * Database query cache for performance optimization
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

type CacheKey = string;

class QueryCache {
  private cache: Map<CacheKey, CacheEntry<unknown>>;
  private maxSize: number;
  private accessOrder: CacheKey[];

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  get<T>(key: CacheKey): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      return null;
    }
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    return entry.data;
  }

  set<T>(key: CacheKey, data: T, ttlMs: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder[0];
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.shift();
      }
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  invalidate(key: CacheKey): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  invalidatePattern(pattern: RegExp): void {
    const keysToInvalidate = this.accessOrder.filter((key) => pattern.test(key));
    for (const key of keysToInvalidate) {
      this.cache.delete(key);
    }
    this.accessOrder = this.accessOrder.filter((key) => !pattern.test(key));
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: this.accessOrder,
    };
  }
}

const globalCache = new QueryCache(200);

export async function cachedQuery<T>(
  key: CacheKey,
  fn: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const cached = globalCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  const result = await fn();
  globalCache.set(key, result, ttlMs);
  return result;
}

export function invalidateCache(key: CacheKey): void {
  globalCache.invalidate(key);
}

export function invalidateCachePattern(pattern: RegExp): void {
  globalCache.invalidatePattern(pattern);
}

export function clearCache(): void {
  globalCache.clear();
}

export function getCacheStats() {
  return globalCache.getStats();
}

export const CacheKeys = {
  newsById: (id: string) => 'news:' + id,
  topTags: (limit: number, minImportance: number) => 'tags:top:' + limit + ':' + minImportance,
  listNews: (params: Record<string, unknown>) => 'news:list:' + JSON.stringify(params),
  relatedArticles: (newsId: string, limit: number) => 'news:related:' + newsId + ':' + limit,
};

export const CacheTTL = {
  SHORT: 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 15 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};
