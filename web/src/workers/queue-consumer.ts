/**
 * Cloudflare Queue Consumer for processing RSS items.
 * Handles articles from the crawl queue with retry logic.
 *
 * This worker processes messages from the RSS crawl queue:
 * - Fetches full content using Jina Reader
 * - Analyzes with AI services
 * - Ingests into the database
 * - Handles failures with exponential backoff
 */

import { analyzeArticle } from '@/lib/crawler/ai-analysis';
import { postIngest } from '@/lib/crawler/api-client';
import { loadCrawlerConfig } from '@/lib/crawler/config';
import { fetchContentWithRetry, JinaFetchError, shouldUseJina } from '@/lib/crawler/jina-fetcher';
import { guessContentFormat } from '@/lib/crawler/rss-parser';
import { incrementCounter, logger, recordHistogram } from '@/lib/monitoring';

import type { Env, ExecutionContext } from './types';

/**
 * Export type for worker module.
 */
export type { Env } from './types';

/**
 * Queue consumer worker configuration.
 */
const QUEUE_CONFIG = {
  maxRetries: 5,
  batchSize: 10,
  maxConcurrency: 5,
};

/**
 * Default export for queue consumer.
 */
export default {
  /**
   * Handle messages from the crawl queue.
   */
  async queue(
    batch: {
      messages: Array<{
        id: string;
        timestamp: number;
        retryCount: number;
        body: import('@/lib/crawler/types').CrawlQueueMessage;
        ack(): void;
        retry(options?: { delayMs?: number }): void;
      }>;
    },
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let retried = 0;

    await logger.info('Queue batch received', {
      messageCount: batch.messages.length,
    });

    // Process each message
    for (const message of batch.messages) {
      try {
        await processQueueMessage(env, message);
        message.ack();
        processed++;
        succeeded++;
      } catch (error) {
        processed++;
        failed++;

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Retry logic
        if (message.retryCount < QUEUE_CONFIG.maxRetries) {
          retried++;
          await logger.warn('Queue message retry', {
            messageId: message.id,
            retryCount: message.retryCount,
            error: errorMessage,
          });

          // Exponential backoff: 2^retryCount * 60 seconds
          const backoff = Math.pow(2, message.retryCount) * 60000;
          message.retry({ delayMs: backoff });
        } else {
          // Max retries reached, send to dead letter queue
          await logger.error('Queue message failed, sending to DLQ', {
            messageId: message.id,
            retryCount: message.retryCount,
            error: errorMessage,
          });

          await sendToDeadLetterQueue(env, message, errorMessage);
          message.ack();
        }
      }
    }

    // Record metrics
    const duration = Date.now() - startTime;
    await incrementCounter('queue_batches_total', 1);
    await incrementCounter('queue_messages_processed', processed);
    await incrementCounter('queue_messages_succeeded', succeeded);
    await incrementCounter('queue_messages_failed', failed);
    await incrementCounter('queue_messages_retried', retried);
    await recordHistogram('queue_batch_duration_ms', duration);

    await logger.info('Queue batch completed', {
      processed,
      succeeded,
      failed,
      retried,
      duration,
    });
  },

  /**
   * Handle fetch requests (for health checks).
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health' || path === '/') {
      return healthCheck(env);
    }

    if (path === '/stats') {
      return handleStats(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

/**
 * Process a single queue message.
 */
async function processQueueMessage(
  env: Env,
  message: {
    id: string;
    timestamp: number;
    retryCount: number;
    body: import('@/lib/crawler/types').CrawlQueueMessage;
  }
): Promise<void> {
  const config = loadCrawlerConfig(env);
  const data = message.body;

  // Validate message data
  if (!data.itemUrl || !data.itemTitle) {
    throw new Error('Invalid message: missing URL or title');
  }

  // Check for duplicates
  if (env.DB) {
    const existing = await env.DB.prepare('SELECT 1 FROM news WHERE url = ? LIMIT 1')
      .bind(data.itemUrl)
      .first();

    if (existing) {
      await logger.debug('Article already exists, skipping', {
        url: data.itemUrl,
      });
      return;
    }
  }

  // Fetch content
  let content = data.itemContent || '';
  let contentFormat = guessContentFormat(content);

  if (shouldUseJina(data.sourceType, data.needCrawl)) {
    try {
      content = await fetchContentWithRetry(config, data.itemUrl, config.maxRetries);
      contentFormat = 'markdown';
    } catch (error) {
      if (error instanceof JinaFetchError && !data.itemContent) {
        // No fallback content available
        throw error;
      }
      // Use RSS content as fallback
    }
  }

  // Analyze with AI
  const analysis = await analyzeArticle(config, {
    title: data.itemTitle,
    content,
    sourceName: data.sourceName,
    sourceCategory: data.sourceCategory,
  });

  // Prepare ingest payload
  const publishedAt = data.itemPubDate ? new Date(data.itemPubDate).getTime() : Date.now();

  const payload = {
    url: data.itemUrl,
    title: data.itemTitle,
    sourceId: data.sourceId,
    sourceName: data.sourceName,
    sourceUrl: data.sourceUrl,
    sourceType: data.sourceType,
    sourceCategory: data.sourceCategory,
    sourceLanguage: data.sourceLanguage,
    publishedAt,
    crawledAt: data.timestamp,
    summary: analysis.summary,
    oneLine: analysis.oneLine,
    content,
    contentFormat,
    category: analysis.category,
    tags: analysis.tags,
    importance: analysis.importance,
    sentiment: analysis.sentiment,
    language: analysis.language,
  };

  // Ingest
  const result = await postIngest(config, payload);

  if (!result.ok) {
    throw new Error(`Ingest failed: ${result.error}`);
  }

  await incrementCounter('queue_articles_ingested', 1, {
    sourceType: data.sourceType,
  });
}

/**
 * Send failed message to dead letter queue.
 */
async function sendToDeadLetterQueue(
  env: Env,
  message: {
    id: string;
    timestamp: number;
    retryCount: number;
    body: import('@/lib/crawler/types').CrawlQueueMessage;
  },
  errorMessage: string
): Promise<void> {
  if (!env.DEAD_LETTER_QUEUE) {
    await logger.error('Dead letter queue not available', {
      messageId: message.id,
    });
    return;
  }

  const deadLetterMessage = {
    originalMessage: message.body,
    error: errorMessage,
    retryCount: message.retryCount,
    firstAttemptAt: message.timestamp,
    lastAttemptAt: Date.now(),
  };

  try {
    await env.DEAD_LETTER_QUEUE.send(deadLetterMessage);
    await incrementCounter('queue_dlq_messages', 1);
  } catch (error) {
    await logger.error('Failed to send to DLQ', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Health check handler.
 */
async function healthCheck(env: Env): Promise<Response> {
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

/**
 * Handle stats endpoint.
 */
async function handleStats(env: Env): Promise<Response> {
  if (!env.METRICS) {
    return new Response(JSON.stringify({ error: 'metrics_not_available' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const stats = await env.METRICS.get('queue:stats', 'json');

    return new Response(
      JSON.stringify({
        stats: stats || {},
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'stats_fetch_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
