/**
 * Tests for rate limiting utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  RateLimiter,
  RateLimitTier,
  createRateLimiter,
  InMemoryRateLimitStore,
  getClientIdentifier,
  type RateLimitStore,
  type RateLimitResult,
} from './rate-limit';

describe('rate limiting', () => {
  describe('InMemoryRateLimitStore', () => {
    let store: InMemoryRateLimitStore;

    beforeEach(() => {
      store = new InMemoryRateLimitStore();
    });

    describe('get', () => {
      it('returns null for non-existent key', async () => {
        expect(await store.get('nonexistent')).toBeNull();
      });

      it('returns stored value', async () => {
        await store.set('key', 42);
        expect(await store.get('key')).toBe(42);
      });

      it('returns null for expired entries', async () => {
        await store.set('key', 42, 1); // 1 second TTL
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(await store.get('key')).toBeNull();
      });

      it('returns value for non-expired entries', async () => {
        await store.set('key', 42, 10); // 10 second TTL
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(await store.get('key')).toBe(42);
      });
    });

    describe('set', () => {
      it('stores value with default TTL', async () => {
        await store.set('key', 100);
        expect(await store.get('key')).toBe(100);
      });

      it('overwrites existing value', async () => {
        await store.set('key', 100);
        await store.set('key', 200);
        expect(await store.get('key')).toBe(200);
      });

      it('stores value with custom TTL', async () => {
        await store.set('key', 100, 5);
        expect(await store.get('key')).toBe(100);
      });
    });

    describe('increment', () => {
      it('returns 1 for new key', async () => {
        const value = await store.increment('counter');
        expect(value).toBe(1);
      });

      it('increments existing value', async () => {
        await store.increment('counter');
        const value = await store.increment('counter');
        expect(value).toBe(2);
      });

      it('resets expired key on increment', async () => {
        await store.increment('counter', 1);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const value = await store.increment('counter');
        expect(value).toBe(1);
      });

      it('increments multiple times', async () => {
        for (let i = 0; i < 5; i++) {
          await store.increment('counter');
        }
        expect(await store.increment('counter')).toBe(6);
      });
    });

    describe('clear', () => {
      it('clears all entries', async () => {
        await store.set('key1', 1);
        await store.set('key2', 2);
        await store.increment('counter');

        store.clear();

        expect(await store.get('key1')).toBeNull();
        expect(await store.get('key2')).toBeNull();
      });
    });
  });

  describe('RateLimiter', () => {
    let limiter: RateLimiter;
    let mockStore: RateLimitStore;

    beforeEach(() => {
      mockStore = {
        get: vi.fn(),
        set: vi.fn(),
        increment: vi.fn(),
      };
      limiter = new RateLimiter({ limit: 10, window: 60, keyPrefix: 'test' }, mockStore);
    });

    describe('check', () => {
      it('allows first request', async () => {
        mockStore.increment.mockResolvedValue(1);

        const result = await limiter.check('identifier');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(1);
        expect(result.limit).toBe(10);
      });

      it('allows requests under limit', async () => {
        mockStore.increment.mockResolvedValue(5);

        const result = await limiter.check('identifier');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(5);
        expect(result.remaining).toBe(5);
      });

      it('allows requests at limit', async () => {
        mockStore.increment.mockResolvedValue(10);

        const result = await limiter.check('identifier');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(10);
        expect(result.remaining).toBe(0);
        expect(result.retryAfter).toBe(0);
      });

      it('blocks requests over limit', async () => {
        mockStore.increment.mockResolvedValue(15);

        const result = await limiter.check('identifier');

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('calculates reset time correctly', async () => {
        mockStore.increment.mockResolvedValue(1);

        const result = await limiter.check('identifier');

        expect(result.resetAfter).toBeGreaterThan(0);
        expect(result.resetAfter).toBeLessThanOrEqual(60);
      });

      it('returns 0 retryAfter when allowed', async () => {
        mockStore.increment.mockResolvedValue(1);

        const result = await limiter.check('identifier');

        expect(result.retryAfter).toBe(0);
      });

      it('uses custom window key', async () => {
        mockStore.increment.mockResolvedValue(1);

        await limiter.check('identifier', 'custom-window');

        expect(mockStore.increment).toHaveBeenCalledWith(
          expect.stringContaining('custom-window'),
          60
        );
      });
    });

    describe('checkRequest', () => {
      it('extracts IP from request headers', async () => {
        mockStore.increment.mockResolvedValue(1);

        const request = new Request('https://example.com', {
          headers: { 'cf-connecting-ip': '192.168.1.1' },
        });

        await limiter.checkRequest(request);

        expect(mockStore.increment).toHaveBeenCalledWith(
          expect.stringContaining('192.168.1.1'),
          60
        );
      });

      it('falls back to user agent hash when IP not available', async () => {
        mockStore.increment.mockResolvedValue(1);

        const request = new Request('https://example.com', {
          headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
        });

        await limiter.checkRequest(request);

        expect(mockStore.increment).toHaveBeenCalledWith(expect.stringContaining('ua:'), 60);
      });
    });

    describe('reset', () => {
      it('resets rate limit for identifier', async () => {
        await limiter.reset('identifier');

        expect(mockStore.set).toHaveBeenCalledWith(expect.stringContaining('identifier'), 0, 60);
      });
    });

    describe('createHeaders', () => {
      it('creates headers from result', () => {
        const result: RateLimitResult = {
          allowed: true,
          current: 5,
          limit: 10,
          resetAfter: 30,
          retryAfter: 0,
        };

        const headers = RateLimiter.createHeaders(result);

        expect(headers['X-RateLimit-Limit']).toBe('10');
        expect(headers['X-RateLimit-Remaining']).toBe('5');
        expect(headers['X-RateLimit-Reset']).toBe('30');
        expect(headers['Retry-After']).toBeUndefined();
      });

      it('includes retry-when not allowed', () => {
        const result: RateLimitResult = {
          allowed: false,
          current: 10,
          limit: 10,
          resetAfter: 30,
          retryAfter: 30,
        };

        const headers = RateLimiter.createHeaders(result);

        expect(headers['Retry-After']).toBe('30');
      });

      it('calculates remaining correctly', () => {
        const result: RateLimitResult = {
          allowed: true,
          current: 0,
          limit: 10,
          resetAfter: 30,
          retryAfter: 0,
        };

        const headers = RateLimiter.createHeaders(result);

        expect(headers['X-RateLimit-Remaining']).toBe('10');
      });

      it('handles negative remaining', () => {
        const result: RateLimitResult = {
          allowed: false,
          current: 15,
          limit: 10,
          resetAfter: 30,
          retryAfter: 30,
        };

        const headers = RateLimiter.createHeaders(result);

        expect(headers['X-RateLimit-Remaining']).toBe('0');
      });
    });
  });

  describe('RateLimitTier', () => {
    it('has PUBLIC tier with correct values', () => {
      expect(RateLimitTier.PUBLIC.limit).toBe(60);
      expect(RateLimitTier.PUBLIC.window).toBe(60);
      expect(RateLimitTier.PUBLIC.keyPrefix).toBe('public');
    });

    it('has SEARCH tier with correct values', () => {
      expect(RateLimitTier.SEARCH.limit).toBe(20);
      expect(RateLimitTier.SEARCH.window).toBe(60);
      expect(RateLimitTier.SEARCH.keyPrefix).toBe('search');
    });

    it('has INGEST tier with correct values', () => {
      expect(RateLimitTier.INGEST.limit).toBe(10);
      expect(RateLimitTier.INGEST.window).toBe(60);
      expect(RateLimitTier.INGEST.keyPrefix).toBe('ingest');
    });

    it('has ADMIN tier with correct values', () => {
      expect(RateLimitTier.ADMIN.limit).toBe(30);
      expect(RateLimitTier.ADMIN.window).toBe(60);
      expect(RateLimitTier.ADMIN.keyPrefix).toBe('admin');
    });

    it('has ITEM tier with correct values', () => {
      expect(RateLimitTier.ITEM.limit).toBe(100);
      expect(RateLimitTier.ITEM.window).toBe(60);
      expect(RateLimitTier.ITEM.keyPrefix).toBe('item');
    });
  });

  describe('createRateLimiter', () => {
    it('creates a rate limiter with specified tier', () => {
      const limiter = createRateLimiter(RateLimitTier.SEARCH);

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('creates rate limiter with custom store', () => {
      const customStore: RateLimitStore = {
        get: vi.fn(),
        set: vi.fn(),
        increment: vi.fn(),
      };

      const limiter = createRateLimiter(RateLimitTier.PUBLIC, customStore);

      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('getClientIdentifier', () => {
    it('extracts IP from cf-connecting-ip header', () => {
      const request = new Request('https://example.com', {
        headers: { 'cf-connecting-ip': '192.168.1.1' },
      });

      const identifier = getClientIdentifier(request);

      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('extracts IP from x-forwarded-for header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      });

      const identifier = getClientIdentifier(request);

      expect(identifier).toBe('ip:10.0.0.1');
    });

    it('prioritizes cf-connecting-ip over x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '192.168.1.1',
          'x-forwarded-for': '10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);

      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('falls back to user agent hash when no IP', () => {
      const request = new Request('https://example.com', {
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      const identifier = getClientIdentifier(request);

      expect(identifier).toMatch(/^ua:/);
      expect(identifier).not.toBe('ua:');
    });

    it('handles missing user agent', () => {
      const request = new Request('https://example.com');

      const identifier = getClientIdentifier(request);

      expect(identifier).toMatch(/^ua:/);
    });

    it('produces consistent hash for same user agent', () => {
      const request1 = new Request('https://example.com', {
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
      });
      const request2 = new Request('https://example.com', {
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
      });

      const id1 = getClientIdentifier(request1);
      const id2 = getClientIdentifier(request2);

      expect(id1).toBe(id2);
    });

    it('produces different hashes for different user agents', () => {
      const request1 = new Request('https://example.com', {
        headers: { 'user-agent': 'Mozilla/5.0 Test1' },
      });
      const request2 = new Request('https://example.com', {
        headers: { 'user-agent': 'Mozilla/5.0 Test2' },
      });

      const id1 = getClientIdentifier(request1);
      const id2 = getClientIdentifier(request2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('integration tests', () => {
    it('tracks requests across multiple checks', async () => {
      const limiter = new RateLimiter({
        limit: 5,
        window: 60,
        keyPrefix: 'integration',
      });

      const results: RateLimitResult[] = [];

      for (let i = 0; i < 7; i++) {
        results.push(await limiter.check('user123'));
      }

      // First 5 should be allowed
      for (let i = 0; i < 5; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // Last 2 should be blocked
      expect(results[5].allowed).toBe(false);
      expect(results[6].allowed).toBe(false);
    });

    it('resets limit across windows', async () => {
      const limiter = new RateLimiter({
        limit: 2,
        window: 1,
        keyPrefix: 'window-test',
      });

      expect((await limiter.check('user')).allowed).toBe(true);
      expect((await limiter.check('user')).allowed).toBe(true);
      expect((await limiter.check('user')).allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again after window expires
      expect((await limiter.check('user')).allowed).toBe(true);
    });

    it('handles multiple identifiers independently', async () => {
      const limiter = new RateLimiter({
        limit: 2,
        window: 60,
        keyPrefix: 'multi-test',
      });

      // User1 makes 2 requests
      expect((await limiter.check('user1')).allowed).toBe(true);
      expect((await limiter.check('user1')).allowed).toBe(true);
      expect((await limiter.check('user1')).allowed).toBe(false);

      // User2 should still be allowed
      expect((await limiter.check('user2')).allowed).toBe(true);
      expect((await limiter.check('user2')).allowed).toBe(true);
      expect((await limiter.check('user2')).allowed).toBe(false);
    });
  });
});
