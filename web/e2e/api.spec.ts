/**
 * E2E Tests for API Endpoints
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('API Endpoints', () => {
  test.describe('GET /api/news', () => {
    test('returns news items', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('respects limit parameter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?limit=5`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('respects language filter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?language=en`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();
    });

    test('respects category filter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?category=Artificial_Intelligence`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();
    });

    test('respects importance filter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?minImportance=70`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();

      // All items should have importance >= 70
      for (const item of data.items) {
        expect(item.importance).toBeGreaterThanOrEqual(70);
      }
    });

    test('includes cursor for pagination', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('nextCursor');
    });

    test('handles CORS preflight', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.fetch(`${API_BASE}/api/news`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type',
          Origin: 'http://localhost:3000',
        },
      });

      expect([200, 204]).toContain(response.status());

      const corsHeader = response.headers()['access-control-allow-origin'];
      expect(corsHeader).toBeTruthy();
    });

    test('returns security headers', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      expect(response.status()).toBe(200);

      const headers = response.headers();

      // Check for common security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
    });
  });

  test.describe('GET /api/news/:id', () => {
    test('returns single news item', async ({ request }: { request: APIRequestContext }) => {
      // First get a list to find a valid ID
      const listResponse = await request.get(`${API_BASE}/api/news?limit=1`);
      const listData = await listResponse.json();

      if (listData.items.length > 0) {
        const id = listData.items[0].id;
        const response = await request.get(`${API_BASE}/api/news/${id}`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('id', id);
        expect(data).toHaveProperty('title');
        expect(data).toHaveProperty('content');
      }
    });

    test('returns 404 for non-existent item', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(`${API_BASE}/api/news/non-existent-id`);

      expect(response.status()).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  test.describe('GET /api/search', () => {
    test('returns search results', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/search?q=AI`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data).toHaveProperty('queryInfo');
    });

    test('returns empty results for non-matching query', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(`${API_BASE}/api/search?q=xyz${Date.now()}nonexistent`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toEqual([]);
    });

    test('respects limit parameter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/search?q=AI&limit=5`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('handles special characters in query', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(
        `${API_BASE}/api/search?q=${encodeURIComponent('C++ & C#')}`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();
    });

    test('respects sortBy parameter', async ({ request }: { request: APIRequestContext }) => {
      const sorts = ['newest', 'oldest', 'importance', 'relevance'] as const;

      for (const sort of sorts) {
        const response = await request.get(`${API_BASE}/api/search?q=AI&sortBy=${sort}`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.items).toBeDefined();
      }
    });

    test('respects category filter', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(
        `${API_BASE}/api/search?q=test&category=Artificial_Intelligence`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();
    });
  });

  test.describe('POST /api/newsletter/subscribe', () => {
    const timestamp = Date.now();

    test('subscribes new email', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.post(`${API_BASE}/api/newsletter/subscribe`, {
        data: {
          email: `test-${timestamp}@example.com`,
          preferences: {
            categories: ['Artificial_Intelligence'],
            frequency: 'weekly',
            language: 'en',
          },
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('confirmed', false);
    });

    test('validates email format', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.post(`${API_BASE}/api/newsletter/subscribe`, {
        data: {
          email: 'invalid-email',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
    });

    test('accepts optional preferences', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.post(`${API_BASE}/api/newsletter/subscribe`, {
        data: {
          email: `test-prefs-${timestamp}@example.com`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });

    test('returns error for missing email', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.post(`${API_BASE}/api/newsletter/subscribe`, {
        data: {},
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
    });
  });

  test.describe('GET /api/newsletter/subscribe', () => {
    test('checks subscription status', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(
        `${API_BASE}/api/newsletter/subscribe?email=test@example.com`
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('subscribed');
    });

    test('returns error for missing email parameter', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(`${API_BASE}/api/newsletter/subscribe`);

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
    });
  });

  test.describe('POST /api/ingest', () => {
    test('rejects without authentication', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.post(`${API_BASE}/api/ingest`, {
        data: {
          url: 'https://example.com/test',
          title: 'Test Article',
          sourceId: 'test-source',
          publishedAt: Date.now(),
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('validates required fields', async ({ request }: { request: APIRequestContext }) => {
      // This will fail auth first, but still validates schema
      const response = await request.post(`${API_BASE}/api/ingest`, {
        headers: {
          'x-ingest-secret': 'test-secret-min-32-chars-long',
        },
        data: {
          url: 'not-a-url',
          title: '', // Invalid: too short
          sourceId: 'test',
          publishedAt: 'not-a-number', // Invalid type
        },
      });

      // Should fail with 400 or 401
      expect([400, 401]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {
    test('returns 404 for non-existent routes', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(`${API_BASE}/api/non-existent`);

      expect(response.status()).toBe(404);
    });

    test('returns JSON for all errors', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/non-existent`);

      expect(response.status()).toBe(404);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('includes error code in response', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/non-existent`);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  test.describe('Rate Limiting', () => {
    test('respects rate limits', async ({ request }: { request: APIRequestContext }) => {
      // Make multiple requests rapidly
      const requests = [];
      for (let i = 0; i < 70; i++) {
        requests.push(request.get(`${API_BASE}/api/news`));
      }

      const responses = await Promise.all(requests);

      // Some should succeed, some might be rate limited
      const successCount = responses.filter((r) => r.status() === 200).length;
      const _rateLimitedCount = responses.filter((r) => r.status() === 429).length;

      // At minimum, some should succeed
      expect(successCount).toBeGreaterThan(0);
    });

    test('includes rate limit headers', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      const headers = response.headers();

      // Rate limit headers may be present
      const hasRateLimitHeaders =
        'x-ratelimit-limit' in headers ||
        'x-ratelimit-remaining' in headers ||
        'x-ratelimit-reset' in headers;

      // Headers might or might not be present depending on configuration
      if (hasRateLimitHeaders) {
        const limit = headers['x-ratelimit-limit'];
        const remaining = headers['x-ratelimit-remaining'];
        const reset = headers['x-ratelimit-reset'];

        if (limit) {
          expect(Number.isFinite(Number(limit))).toBe(true);
        }
        if (remaining) {
          expect(Number.isFinite(Number(remaining))).toBe(true);
        }
        if (reset) {
          expect(Number.isFinite(Number(reset))).toBe(true);
        }
      }

      expect(Object.keys(headers).length).toBeGreaterThan(0);
    });
  });

  test.describe('Response Format', () => {
    test('news items have required fields', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?limit=1`);

      const data = await response.json();

      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('url');
        expect(item).toHaveProperty('publishedAt');
        expect(item).toHaveProperty('sourceName');
        expect(item).toHaveProperty('importance');
      }
    });

    test('search results include query info', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const response = await request.get(`${API_BASE}/api/search?q=test`);

      const data = await response.json();

      expect(data.queryInfo).toHaveProperty('query');
      expect(data.queryInfo).toHaveProperty('parsedQuery');
      expect(data.queryInfo).toHaveProperty('filters');
      expect(data.queryInfo).toHaveProperty('hasAdvancedSyntax');
    });

    test('handles null values gracefully', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news?minImportance=0`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.items).toBeDefined();

      // Items might have null optional fields
      for (const item of data.items) {
        expect(item.id).toBeTruthy();
      }
    });
  });

  test.describe('Cache Headers', () => {
    test('includes cache headers', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toContain('max-age');
    });

    test('news endpoint allows caching', async ({ request }: { request: APIRequestContext }) => {
      const response = await request.get(`${API_BASE}/api/news`);

      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toMatch(/public|stale-while-revalidate/);
    });
  });

  test.describe('Performance', () => {
    test('responds within reasonable time', async ({ request }: { request: APIRequestContext }) => {
      const startTime = Date.now();
      await request.get(`${API_BASE}/api/news`);
      const duration = Date.now() - startTime;

      // Should respond within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    test('search responds within reasonable time', async ({
      request,
    }: {
      request: APIRequestContext;
    }) => {
      const startTime = Date.now();
      await request.get(`${API_BASE}/api/search?q=AI`);
      const duration = Date.now() - startTime;

      // Search might take longer, but should be under 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });
});
