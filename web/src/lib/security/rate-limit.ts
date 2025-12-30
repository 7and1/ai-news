/**
 * Rate limiting middleware using Cloudflare Workers KV.
 * Provides configurable rate limiting for API endpoints.
 */

import { z } from 'zod';

/**
 * Minimal KV namespace type for Cloudflare Workers.
 */
type KVNamespace = {
  get: (key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream') => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

/**
 * Rate limit configuration for different endpoint types.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Unique identifier for this rate limit tier */
  keyPrefix: string;
}

/**
 * Predefined rate limit tiers.
 */
export const RateLimitTier = {
  /** Public endpoints (news listing, RSS feeds) */
  PUBLIC: { limit: 60, window: 60, keyPrefix: 'public' } as RateLimitConfig,

  /** Search endpoints (more expensive) */
  SEARCH: { limit: 20, window: 60, keyPrefix: 'search' } as RateLimitConfig,

  /** Ingest endpoints (internal, higher limits) */
  INGEST: { limit: 10, window: 60, keyPrefix: 'ingest' } as RateLimitConfig,

  /** Admin endpoints (very restrictive) */
  ADMIN: { limit: 30, window: 60, keyPrefix: 'admin' } as RateLimitConfig,

  /** Individual item fetch (higher limit, lower cost) */
  ITEM: { limit: 100, window: 60, keyPrefix: 'item' } as RateLimitConfig,
} as const;

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current usage count */
  current: number;
  /** Remaining requests in the window */
  remaining: number;
  /** Maximum allowed requests */
  limit: number;
  /** Seconds until the limit resets */
  resetAfter: number;
  /** Recommended retry-after seconds if not allowed */
  retryAfter: number;
}

/**
 * Rate limit info headers to add to responses.
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

/**
 * KV store interface for rate limiting.
 * This allows us to use different storage backends.
 */
export interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl?: number): Promise<void>;
  increment(key: string, ttl?: number): Promise<number>;
}

/**
 * In-memory rate limit store for development/testing.
 * NOT suitable for production (not distributed, lost on restart).
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private data = new Map<string, { value: number; expires: number }>();

  async get(key: string): Promise<number | null> {
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: number, ttl = 60): Promise<void> {
    this.data.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async increment(key: string, ttl = 60): Promise<number> {
    const entry = this.data.get(key);
    const now = Date.now();

    if (!entry || now > entry.expires) {
      await this.set(key, 1, ttl);
      return 1;
    }

    const newValue = entry.value + 1;
    await this.set(key, newValue, ttl);
    return newValue;
  }

  /** Clear all entries (useful for testing) */
  clear(): void {
    this.data.clear();
  }
}

/**
 * KV-based rate limit store using Cloudflare Workers KV.
 */
class KvRateLimitStore implements RateLimitStore {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<number | null> {
    const value = await this.kv.get(key, 'text');
    return value ? Number.parseInt(value, 10) : null;
  }

  async set(key: string, value: number, ttl?: number): Promise<void> {
    await this.kv.put(key, String(value), {
      expirationTtl: ttl,
    });
  }

  async increment(key: string, ttl = 60): Promise<number> {
    // KV doesn't have atomic increment, so we need to do a get-set operation
    // In production, you might want to use Durable Objects for true atomicity
    const current = await this.get(key);
    const newValue = (current ?? 0) + 1;
    await this.set(key, newValue, ttl);
    return newValue;
  }
}

/**
 * Extracts a client identifier from the request.
 * Uses CF-Connecting-IP if available (Cloudflare), falls back to a generic identifier.
 */
export function getClientIdentifier(request: Request): string {
  // Try Cloudflare headers first
  const cfIp = (
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]
  )?.trim();

  if (cfIp) {
    return `ip:${cfIp}`;
  }

  // Fallback to a generic identifier (less ideal but functional)
  const userAgent = request.headers.get('user-agent')?.slice(0, 50) || 'unknown';
  const hash = simpleHash(userAgent);
  return `ua:${hash}`;
}

/**
 * Simple hash function for user agent fallback.
 * This is NOT cryptographically secure, just for consistent identification.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Creates a rate limiter instance.
 *
 * @param config - Rate limit configuration
 * @param store - KV store (defaults to in-memory for development)
 */
export class RateLimiter {
  constructor(
    private config: RateLimitConfig,
    private store: RateLimitStore = new InMemoryRateLimitStore()
  ) {}

  /**
   * Checks if a request should be rate limited.
   *
   * @param identifier - Unique client identifier (IP, API key, etc.)
   * @param windowKey - Optional key to identify the time window (default: current minute)
   * @returns Rate limit check result
   */
  async check(identifier: string, windowKey?: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = windowKey ?? Math.floor(now / (this.config.window * 1000));
    const key = `ratelimit:${this.config.keyPrefix}:${identifier}:${windowStart}`;

    const current = await this.store.increment(key, this.config.window);
    const allowed = current <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - current);
    const resetAfter = this.config.window - ((now / 1000) % this.config.window);

    return {
      allowed,
      current,
      remaining,
      limit: this.config.limit,
      resetAfter: Math.ceil(resetAfter),
      retryAfter: allowed ? 0 : Math.ceil(resetAfter),
    };
  }

  /**
   * Checks rate limit for an HTTP request.
   *
   * @param request - The incoming request
   * @returns Rate limit check result
   */
  async checkRequest(request: Request): Promise<RateLimitResult> {
    const identifier = getClientIdentifier(request);
    return this.check(identifier);
  }

  /**
   * Resets the rate limit for a specific identifier.
   * Useful for testing or administrative purposes.
   *
   * @param identifier - Client identifier to reset
   */
  async reset(identifier: string): Promise<void> {
    const windowStart = Math.floor(Date.now() / (this.config.window * 1000));
    const key = `ratelimit:${this.config.keyPrefix}:${identifier}:${windowStart}`;
    await this.store.set(key, 0, this.config.window);
  }

  /**
   * Creates rate limit headers for a response.
   *
   * @param result - Rate limit check result
   * @returns Headers object with rate limit information
   */
  static createHeaders(result: RateLimitResult): RateLimitHeaders {
    const remaining = Math.max(
      0,
      (result as unknown as { remaining?: number }).remaining ?? result.limit - result.current
    );

    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(result.resetAfter),
    };

    if (!result.allowed) {
      headers['Retry-After'] = String(result.retryAfter);
    }

    return headers;
  }
}

/**
 * Creates a rate limiter with the specified tier.
 *
 * @param tier - Rate limit tier
 * @param store - Optional KV store
 * @returns Configured rate limiter
 */
export function createRateLimiter(tier: RateLimitConfig, store?: RateLimitStore): RateLimiter {
  return new RateLimiter(tier, store);
}

/**
 * Creates a KV-based rate limiter for production.
 *
 * @param tier - Rate limit tier
 * @param kv - Cloudflare Workers KV namespace
 * @returns Configured rate limiter with KV store
 */
export function createKvRateLimiter(tier: RateLimitConfig, kv: KVNamespace): RateLimiter {
  return new RateLimiter(tier, new KvRateLimitStore(kv));
}

/**
 * Validates rate limit configuration from environment variables.
 */
export const rateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  public: z.object({
    limit: z.number().int().positive().default(60),
    window: z.number().int().positive().default(60),
  }),
  search: z.object({
    limit: z.number().int().positive().default(20),
    window: z.number().int().positive().default(60),
  }),
  ingest: z.object({
    limit: z.number().int().positive().default(10),
    window: z.number().int().positive().default(60),
  }),
  admin: z.object({
    limit: z.number().int().positive().default(30),
    window: z.number().int().positive().default(60),
  }),
  item: z.object({
    limit: z.number().int().positive().default(100),
    window: z.number().int().positive().default(60),
  }),
});

export type RateLimitEnvConfig = z.infer<typeof rateLimitConfigSchema>;

/**
 * Parses rate limit configuration from environment variables.
 */
export function parseRateLimitConfig(env: Record<string, string | undefined>): RateLimitEnvConfig {
  return rateLimitConfigSchema.parse({
    enabled: env.RATE_LIMIT_ENABLED !== 'false',
    public: {
      limit: Number.parseInt(env.RATE_LIMIT_PUBLIC_REQUESTS || '60', 10),
      window: Number.parseInt(env.RATE_LIMIT_PUBLIC_WINDOW || '60', 10),
    },
    search: {
      limit: Number.parseInt(env.RATE_LIMIT_SEARCH_REQUESTS || '20', 10),
      window: Number.parseInt(env.RATE_LIMIT_SEARCH_WINDOW || '60', 10),
    },
    ingest: {
      limit: Number.parseInt(env.RATE_LIMIT_INGEST_REQUESTS || '10', 10),
      window: Number.parseInt(env.RATE_LIMIT_INGEST_WINDOW || '60', 10),
    },
    admin: {
      limit: Number.parseInt(env.RATE_LIMIT_ADMIN_REQUESTS || '30', 10),
      window: Number.parseInt(env.RATE_LIMIT_ADMIN_WINDOW || '60', 10),
    },
    item: {
      limit: Number.parseInt(env.RATE_LIMIT_ITEM_REQUESTS || '100', 10),
      window: Number.parseInt(env.RATE_LIMIT_ITEM_WINDOW || '60', 10),
    },
  });
}

// Export the in-memory store instance for testing
export { InMemoryRateLimitStore };
