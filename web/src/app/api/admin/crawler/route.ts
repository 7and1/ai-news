/**
 * Crawler metrics and management API.
 * Provides visibility into crawler status, metrics, and controls.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchDueSources } from '@/lib/crawler/api-client';
import { loadCrawlerConfig } from '@/lib/crawler/config';
import { batchCrawlSources } from '@/lib/crawler/crawler';
import { getEnv } from '@/lib/d1';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import {
  incrementCounter,
  logger,
  generateCorrelationId,
  setCorrelationId,
  reportError,
} from '@/lib/monitoring';

/**
 * GET /api/admin/crawler - Get crawler status and metrics
 *
 * Returns:
 * - Recent crawler runs
 * - Source statistics by type
 * - Queue statistics
 * - Error counts
 */
export const GET = createMiddleware(
  {
    requireSecret: { key: 'CRON_SECRET' },
    rateLimit: 'ADMIN',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);

    try {
      const env = await getEnv();
      const db = env.DB;

      if (!db) {
        throw new Error('Database not available');
      }

      // Get source statistics
      const sourceStats = await db
        .prepare(
          `
          SELECT
            type,
            COUNT(*) as total,
            SUM(CASE WHEN last_crawled_at IS NOT NULL THEN 1 ELSE 0 END) as crawled,
            SUM(CASE WHEN last_crawled_at > ? THEN 1 ELSE 0 END) as recent_crawled,
            SUM(error_count) as total_errors,
            AVG(CASE WHEN last_crawled_at IS NOT NULL THEN (? - last_crawled_at) / 1000 END) as avg_seconds_since_crawl
          FROM sources
          WHERE is_active = 1
          GROUP BY type
          ORDER BY total DESC
        `
        )
        .bind(Date.now() - 24 * 60 * 60 * 1000, Date.now())
        .all();

      // Get overall statistics
      const overallStats = await db
        .prepare(
          `
          SELECT
            COUNT(*) as total_sources,
            SUM(CASE WHEN last_crawled_at IS NOT NULL THEN 1 ELSE 0 END) as ever_crawled,
            SUM(CASE WHEN last_crawled_at > ? THEN 1 ELSE 0 END) as crawled_last_24h,
            SUM(error_count) as total_errors
          FROM sources
          WHERE is_active = 1
        `
        )
        .bind(Date.now() - 24 * 60 * 60 * 1000)
        .first();

      // Get error sources (sources with high error counts)
      const errorSources = await db
        .prepare(
          `
          SELECT id, name, url, type, error_count, last_crawled_at
          FROM sources
          WHERE is_active = 1 AND error_count > 0
          ORDER BY error_count DESC
          LIMIT 20
        `
        )
        .all();

      // Get recent crawler metrics from KV
      let crawlerMetrics = null;
      if (env.METRICS) {
        try {
          const recentRuns = await env.METRICS.get('crawler:recent_runs', 'json');
          const lastRun = await env.METRICS.get('crawler:last_run');
          crawlerMetrics = {
            recentRuns: recentRuns || [],
            lastRun: lastRun ? Number(lastRun) : null,
          };
        } catch {
          // KV read failed
        }
      }

      // Get queue metrics if available
      let queueMetrics = null;
      if (env.METRICS) {
        try {
          const queueStats = await env.METRICS.get('queue:stats', 'json');
          queueMetrics = queueStats || null;
        } catch {
          // KV read failed
        }
      }

      await incrementCounter('http_requests_total', 1, {
        method: 'GET',
        path: '/api/admin/crawler',
        status: '2xx',
      });

      const response = NextResponse.json({
        sources: {
          byType: sourceStats.results || [],
          overall: overallStats || {},
          errorSources: errorSources.results || [],
        },
        crawler: crawlerMetrics,
        queue: queueMetrics,
        timestamp: Date.now(),
      });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (err) {
      await reportError(err, {
        endpoint: '/api/admin/crawler',
        correlationId,
      });
      await incrementCounter('http_errors_total', 1, {
        method: 'GET',
        path: '/api/admin/crawler',
        status: '500',
      });
      throw err;
    }
  }
);

/**
 * POST /api/admin/crawler - Trigger manual crawl
 *
 * Body:
 *   priority: "high" | "medium" | "low"
 *   sourceTypes?: string[] - Optional filter by source types
 */
export const POST = createMiddleware(
  {
    requireSecret: { key: 'CRON_SECRET' },
    rateLimit: 'ADMIN',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);

    try {
      const body = await request.json().catch(() => ({}));
      const priority = body.priority || 'medium';
      const sourceTypes = body.sourceTypes;

      // Validate priority
      if (!['high', 'medium', 'low'].includes(priority)) {
        throw new ValidationError({
          priority: 'Must be one of: high, medium, low',
        });
      }

      await incrementCounter('crawler_manual_triggers', 1, { priority });

      await logger.info('Manual crawl triggered', {
        priority,
        sourceTypes,
        correlationId,
      });

      const startedAt = Date.now();
      const env = await getEnv();
      const db = env.DB;

      if (!db) {
        throw new Error('Database not available');
      }

      const config = loadCrawlerConfig(env as unknown as CloudflareEnv);
      const selectedTypes =
        Array.isArray(sourceTypes) && sourceTypes.length > 0
          ? (sourceTypes as string[])
          : priority === 'high'
            ? (config.highPriorityTypes as unknown as string[])
            : priority === 'medium'
              ? (config.mediumPriorityTypes as unknown as string[])
              : (config.lowPriorityTypes as unknown as string[]);

      const dueSources = await fetchDueSources(config, db as any, {
        limit: config.sourcesPerBatch,
        sourceTypes: selectedTypes,
      });

      const sources = dueSources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        type: s.type as any,
        category: s.category,
        language: s.language,
        crawlFrequency: s.crawlFrequency,
        needCrawl: s.needCrawl,
        lastCrawledAt: s.lastCrawledAt,
        errorCount: s.errorCount,
      }));

      const result =
        sources.length > 0 ? await batchCrawlSources(config, db as any, sources as any) : null;
      const durationMs = Date.now() - startedAt;

      const response = NextResponse.json({
        success: true,
        message: sources.length > 0 ? 'Crawl completed' : 'No due sources',
        priority,
        sourceTypes,
        sources: sources.length,
        total: result?.total ?? { ok: 0, skipped: 0, failed: 0, total: 0 },
        durationMs,
      });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (err) {
      await reportError(err, {
        endpoint: '/api/admin/crawler',
        correlationId,
      });
      await incrementCounter('http_errors_total', 1, {
        method: 'POST',
        path: '/api/admin/crawler',
        status: '500',
      });
      throw err;
    }
  }
);

/**
 * OPTIONS handler for CORS preflight.
 */
export const OPTIONS = withSecurityHeaders(async (): Promise<NextResponse> => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
