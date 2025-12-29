/**
 * Cloudflare Queue Producer for RSS crawl items.
 * Adds RSS items to the processing queue for asynchronous processing.
 *
 * This can be called from:
 * - The scheduled crawler (to decouple fetching from processing)
 * - Manual triggers (via HTTP API)
 * - Webhooks (for real-time article submissions)
 */

import { fetchDueSources } from '@/lib/crawler/api-client';
import { loadCrawlerConfig } from '@/lib/crawler/config';
import { filterAndSortItems, parseRssFeed } from '@/lib/crawler/rss-parser';
import type { CrawlQueueMessage } from '@/lib/crawler/types';
import { incrementCounter, logger } from '@/lib/monitoring';

import type { ExecutionContext, ScheduledEvent } from './types';

/**
 * Export type for worker module.
 */
export type { Env, ExecutionContext, ScheduledEvent } from './types';

/**
 * Default export for queue producer.
 */
export default {
  /**
   * Handle fetch requests.
   */
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health' || path === '/') {
      return healthCheck(env);
    }

    // Enqueue items from a source
    if (path === '/enqueue') {
      return handleEnqueue(request, env);
    }

    // Enqueue items from due sources
    if (path === '/enqueue-due') {
      return handleEnqueueDue(request, env);
    }

    // Batch enqueue from multiple sources
    if (path === '/enqueue-batch') {
      return handleEnqueueBatch(request, env);
    }

    // Single article submission
    if (path === '/submit') {
      return handleSubmit(request, env);
    }

    return new Response('Not found', { status: 404 });
  },

  /**
   * Handle scheduled events (optional enqueue trigger).
   */
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareEnv,
    _ctx: ExecutionContext
  ): Promise<Response> {
    await logger.info('Scheduled enqueue triggered', {
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });

    try {
      const result = await enqueueDueSources(env);

      await incrementCounter('producer_scheduled_runs', 1, {
        status: 'success',
      });

      await logger.info('Scheduled enqueue completed', {
        sourcesProcessed: result.sources,
        itemsEnqueued: result.items,
      });

      return new Response(
        JSON.stringify({
          success: true,
          ...result,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    } catch (error) {
      await incrementCounter('producer_scheduled_runs', 1, {
        status: 'error',
      });

      await logger.error('Scheduled enqueue failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(
        JSON.stringify({
          error: 'enqueue_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  },
};

/**
 * Handle enqueue from a single source.
 */
async function handleEnqueue(request: Request, env: CloudflareEnv): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const cronSecret = request.headers.get('X-Cron-Secret');

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cronSecret || '';

  if (token !== env.CRON_SECRET && token !== env.INGEST_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Get source URL from query params or body
  const url = new URL(request.url);
  const sourceUrl = url.searchParams.get('url');

  if (!sourceUrl) {
    return new Response(
      JSON.stringify({ error: 'missing_url', message: 'URL parameter required' }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  try {
    const result = await enqueueFromSourceUrl(env, sourceUrl);

    return new Response(
      JSON.stringify({
        success: true,
        source: sourceUrl,
        itemsEnqueued: result,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'enqueue_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Handle enqueue from due sources.
 */
async function handleEnqueueDue(request: Request, env: CloudflareEnv): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const cronSecret = request.headers.get('X-Cron-Secret');

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cronSecret || '';

  if (token !== env.CRON_SECRET && token !== env.INGEST_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const sourceTypes = url.searchParams.get('types')?.split(',') || undefined;

  try {
    const result = await enqueueDueSources(env, { limit, sourceTypes });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'enqueue_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Handle batch enqueue from multiple sources.
 */
async function handleEnqueueBatch(request: Request, env: CloudflareEnv): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const cronSecret = request.headers.get('X-Cron-Secret');

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cronSecret || '';

  if (token !== env.CRON_SECRET && token !== env.INGEST_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body.sources) || body.sources.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'invalid_body',
          message: 'sources array required',
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    const result = await enqueueBatch(env, body.sources);

    return new Response(
      JSON.stringify({
        success: true,
        sourcesEnqueued: result.sources,
        itemsEnqueued: result.items,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'enqueue_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Handle single article submission.
 */
async function handleSubmit(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const body = await request.json();

    const message: CrawlQueueMessage = {
      sourceId: body.sourceId || 'manual',
      sourceUrl: body.sourceUrl || '',
      sourceName: body.sourceName || 'Manual Submission',
      sourceType: body.sourceType || 'article',
      sourceCategory: body.sourceCategory || null,
      sourceLanguage: body.sourceLanguage || null,
      itemUrl: body.url,
      itemTitle: body.title,
      itemPubDate: body.pubDate || null,
      itemContent: body.content || '',
      needCrawl: body.needCrawl !== false,
      timestamp: Date.now(),
    };

    if (!env.QUEUE) {
      return new Response(JSON.stringify({ error: 'queue_not_available' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    await env.QUEUE.send(message);
    await incrementCounter('producer_manual_submissions', 1);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Article queued for processing',
      }),
      { status: 202, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'submission_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

/**
 * Enqueue items from a source URL.
 */
async function enqueueFromSourceUrl(env: CloudflareEnv, sourceUrl: string): Promise<number> {
  if (!env.QUEUE) {
    throw new Error('Queue not available');
  }

  const config = loadCrawlerConfig(env);

  // Parse the RSS feed
  const feed = await parseRssFeed(sourceUrl);
  const items = filterAndSortItems(feed.items || [], config.itemsPerSource);

  // Enqueue each item
  const messages: CrawlQueueMessage[] = items.map((item) => ({
    sourceId: feed.title || 'unknown',
    sourceUrl,
    sourceName: feed.title || 'Unknown Source',
    sourceType: 'article',
    sourceCategory: null,
    sourceLanguage: null,
    itemUrl: item.link || item.guid || '',
    itemTitle: item.title || '',
    itemPubDate: item.isoDate || item.pubDate || null,
    itemContent: item['content:encoded'] || item.content || item.contentSnippet || '',
    needCrawl: true,
    timestamp: Date.now(),
  }));

  for (const message of messages) {
    await env.QUEUE.send(message);
  }

  await incrementCounter('producer_items_enqueued', messages.length, {
    sourceType: 'article',
  });

  return messages.length;
}

/**
 * Enqueue items from due sources.
 */
async function enqueueDueSources(
  env: CloudflareEnv,
  options: { limit?: number; sourceTypes?: string[] } = {}
): Promise<{
  sources: number;
  items: number;
  errors: number;
}> {
  if (!env.DB) {
    throw new Error('Database not available');
  }

  if (!env.QUEUE) {
    throw new Error('Queue not available');
  }

  const config = loadCrawlerConfig(env);
  const sources = await fetchDueSources(config, env.DB as any, options);

  let itemsEnqueued = 0;
  let errors = 0;

  for (const source of sources) {
    try {
      const feed = await parseRssFeed(source.url);
      const items = filterAndSortItems(feed.items || [], config.itemsPerSource);

      const messages: CrawlQueueMessage[] = items.map(
        (item) =>
          ({
            sourceId: source.id,
            sourceUrl: source.url,
            sourceName: source.name,
            sourceType: source.type as any,
            sourceCategory: source.category as any,
            sourceLanguage: source.language as any,
            itemUrl: item.link || item.guid || '',
            itemTitle: item.title || '',
            itemPubDate: item.isoDate || item.pubDate || null,
            itemContent: item['content:encoded'] || item.content || item.contentSnippet || '',
            needCrawl: source.needCrawl,
            timestamp: Date.now(),
          }) as CrawlQueueMessage
      );

      for (const message of messages) {
        await env.QUEUE.send(message);
      }

      itemsEnqueued += messages.length;
      await incrementCounter('producer_items_enqueued', messages.length, {
        sourceType: source.type,
      });
    } catch (error) {
      errors++;
      await logger.warn('Failed to enqueue source', {
        sourceId: source.id,
        sourceUrl: source.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    sources: sources.length,
    items: itemsEnqueued,
    errors,
  };
}

/**
 * Enqueue from a batch of sources.
 */
async function enqueueBatch(
  env: CloudflareEnv,
  sources: Array<{ id: string; url: string; name: string }>
): Promise<{ sources: number; items: number }> {
  if (!env.QUEUE) {
    throw new Error('Queue not available');
  }

  const config = loadCrawlerConfig(env);
  let itemsEnqueued = 0;

  for (const source of sources) {
    try {
      const feed = await parseRssFeed(source.url);
      const items = filterAndSortItems(feed.items || [], config.itemsPerSource);

      const messages: CrawlQueueMessage[] = items.map((item) => ({
        sourceId: source.id,
        sourceUrl: source.url,
        sourceName: source.name,
        sourceType: 'article',
        sourceCategory: null,
        sourceLanguage: null,
        itemUrl: item.link || item.guid || '',
        itemTitle: item.title || '',
        itemPubDate: item.isoDate || item.pubDate || null,
        itemContent: item['content:encoded'] || item.content || item.contentSnippet || '',
        needCrawl: true,
        timestamp: Date.now(),
      }));

      for (const message of messages) {
        await env.QUEUE.send(message);
      }

      itemsEnqueued += messages.length;
    } catch (error) {
      await logger.warn('Failed to enqueue source in batch', {
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { sources: sources.length, items: itemsEnqueued };
}

/**
 * Health check handler.
 */
async function healthCheck(env: CloudflareEnv): Promise<Response> {
  const checks = {
    queue: false,
    database: false,
    configuration: false,
  };

  // Check queue binding
  checks.queue = Boolean(env.QUEUE);

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
