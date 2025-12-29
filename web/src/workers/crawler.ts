/**
 * Cloudflare Worker for scheduled RSS crawling.
 * Triggered by Cron Events to crawl RSS sources and ingest articles.
 *
 * This worker supports multiple cron schedules for different priority levels:
 * - High priority (articles, blogs, news): Every hour
 * - Medium priority (podcasts, videos): Every 3 hours
 * - Low priority (Twitter, newsletters, WeChat): Every 6 hours
 */

import { loadCrawlerConfig, PRIORITY_SCHEDULES } from '@/lib/crawler/config';
import { crawlByPriority } from '@/lib/crawler/crawler';
import { incrementCounter, logger, recordHistogram } from '@/lib/monitoring';

import type { Env, ExecutionContext } from './types';

/**
 * Export type for worker module.
 */
export type { Env } from './types';

/**
 * Scheduled event handler for cron-triggered crawling.
 */
export default {
  /**
   * Handle scheduled cron events.
   */
  async scheduled(
    event: { cron: string; scheduledTime?: number },
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const startTime = Date.now();
    const cron = event.cron;

    // Determine priority from cron schedule
    const priority = getPriorityFromCron(cron);

    // Log the crawl start
    await logger.info('Scheduled crawl started', {
      cron,
      priority,
      scheduledTime: event.scheduledTime,
    });

    try {
      // Load configuration
      const config = loadCrawlerConfig(env);

      // Validate configuration
      const validation = validateCrawlerConfig(config);
      if (!validation.valid) {
        await logger.error('Invalid crawler configuration', {
          errors: validation.errors,
        });
        return new Response(
          JSON.stringify({
            error: 'invalid_config',
            errors: validation.errors,
          }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        );
      }

      // Perform the crawl
      const result = await performCrawl(env, config, priority);

      // Record metrics
      const duration = Date.now() - startTime;
      await incrementCounter('crawler_runs_total', 1, {
        priority,
        status: 'success',
      });
      await recordHistogram('crawler_duration_ms', duration, { priority });
      await incrementCounter('crawler_articles_processed', result.total.ok, {
        priority,
      });
      await incrementCounter('crawler_articles_failed', result.total.failed, {
        priority,
      });
      await incrementCounter('crawler_sources_processed', result.sources.length, {
        priority,
      });

      await logger.info('Scheduled crawl completed', {
        priority,
        sourcesProcessed: result.sources.length,
        articlesProcessed: result.total.ok,
        articlesFailed: result.total.failed,
        duration,
      });

      return new Response(
        JSON.stringify({
          success: true,
          priority,
          sources: result.sources.length,
          articles: {
            processed: result.total.ok,
            skipped: result.total.skipped,
            failed: result.total.failed,
            total: result.total.total,
          },
          duration,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await incrementCounter('crawler_runs_total', 1, {
        priority,
        status: 'error',
      });
      await recordHistogram('crawler_duration_ms', duration, { priority });

      await logger.error('Scheduled crawl failed', {
        priority,
        error: errorMessage,
        duration,
      });

      return new Response(
        JSON.stringify({
          error: 'crawl_failed',
          message: errorMessage,
          priority,
          duration,
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  },

  /**
   * Handle fetch requests (for manual triggering and health checks).
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health' || path === '/') {
      return healthCheck(env);
    }

    // Manual crawl trigger (with authentication)
    if (path === '/crawl') {
      return handleManualCrawl(request, env);
    }

    // Crawl status
    if (path === '/status') {
      return handleStatus(env);
    }

    // Metrics endpoint
    if (path === '/metrics') {
      return handleMetrics(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

/**
 * Determine priority level from cron expression.
 */
function getPriorityFromCron(cron: string): 'high' | 'medium' | 'low' {
  const schedule = PRIORITY_SCHEDULES.find((s) => s.cronExpression === cron);
  return schedule?.priority ?? 'medium';
}

/**
 * Validate crawler configuration.
 */
function validateCrawlerConfig(config: ReturnType<typeof loadCrawlerConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.ingestSecret) {
    errors.push('INGEST_SECRET is required');
  }

  if (!config.ingestApiUrl) {
    errors.push('INGEST_API_URL is required');
  }

  if (config.sourcesPerBatch < 1 || config.sourcesPerBatch > 500) {
    errors.push('CRAWLER_SOURCES_PER_BATCH must be between 1 and 500');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Perform the actual crawl operation.
 */
async function performCrawl(
  env: Env,
  config: ReturnType<typeof loadCrawlerConfig>,
  priority: 'high' | 'medium' | 'low'
): Promise<{
  sources: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  metrics: Map<string, unknown>;
  total: { ok: number; skipped: number; failed: number; total: number };
}> {
  if (!env.DB) {
    throw new Error('DB binding not available');
  }

  const result = await crawlByPriority(config, env.DB as any, priority);

  return {
    sources: result.sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
    })),
    metrics: result.metrics as Map<string, unknown>,
    total: result.total,
  };
}

/**
 * Health check handler.
 */
async function healthCheck(env: Env): Promise<Response> {
  const checks = {
    database: false,
    configuration: false,
  };

  // Check database
  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1').first();
      checks.database = true;
    }
  } catch {
    // Database check failed
  }

  // Check configuration
  checks.configuration = Boolean(env.INGEST_SECRET);

  const status = Object.values(checks).every(Boolean) ? 'healthy' : 'degraded';

  return new Response(
    JSON.stringify({
      status,
      checks,
      timestamp: Date.now(),
    }),
    {
      status: status === 'healthy' ? 200 : 503,
      headers: { 'content-type': 'application/json' },
    }
  );
}

/**
 * Handle manual crawl trigger.
 */
async function handleManualCrawl(request: Request, env: Env): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const cronSecret = request.headers.get('X-Cron-Secret');

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cronSecret || '';

  if (token !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Get priority from query params
  const url = new URL(request.url);
  const priority = (url.searchParams.get('priority') || 'medium') as 'high' | 'medium' | 'low';

  // Load configuration
  const config = loadCrawlerConfig(env);

  // Perform crawl
  try {
    const result = await performCrawl(env, config, priority);

    return new Response(
      JSON.stringify({
        success: true,
        priority,
        sources: result.sources.length,
        articles: result.total,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'crawl_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Handle crawler status.
 */
async function handleStatus(env: Env): Promise<Response> {
  if (!env.DB || !env.METRICS) {
    return new Response(JSON.stringify({ error: 'database_or_metrics_not_available' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    // Get recent crawler runs from metrics
    const recentRuns = await env.METRICS.get('crawler:recent_runs', 'json');
    const lastRun = await env.METRICS.get('crawler:last_run');

    // Get source counts
    const sourceCounts = await env.DB.prepare(
      `
        SELECT
          type,
          COUNT(*) as count,
          SUM(CASE WHEN last_crawled_at IS NOT NULL THEN 1 ELSE 0 END) as crawled,
          SUM(error_count) as errors
        FROM sources
        WHERE is_active = 1
        GROUP BY type
      `
    ).all();

    return new Response(
      JSON.stringify({
        lastRun: lastRun ? Number(lastRun) : null,
        recentRuns: recentRuns || [],
        sources: sourceCounts.results || [],
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'status_fetch_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Handle metrics endpoint.
 */
async function handleMetrics(env: Env): Promise<Response> {
  if (!env.METRICS) {
    return new Response('Metrics not available', { status: 503 });
  }

  try {
    const metrics = await env.METRICS.get('crawler:metrics', 'json');
    return new Response(JSON.stringify(metrics || {}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
}
