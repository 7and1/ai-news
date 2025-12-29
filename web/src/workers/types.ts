/**
 * Shared types for Cloudflare Workers.
 */

import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

/**
 * Cloudflare Workers execution context.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Cloudflare Workers scheduled event.
 */
export interface ScheduledEvent {
  cron: string;
  scheduledTime?: number;
}

/**
 * Crawler queue message type.
 */
export interface CrawlQueueMessage {
  sourceId: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: string;
  sourceCategory: string | null;
  sourceLanguage: string | null;
  itemUrl: string;
  itemTitle: string;
  itemPubDate: string | null;
  itemContent: string;
  needCrawl: boolean;
  timestamp: number;
}

/**
 * Dead letter queue message type.
 */
export interface DeadLetterMessage {
  originalMessage: CrawlQueueMessage;
  error: string;
  retryCount: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

/**
 * Cloudflare environment bindings.
 */
export interface Env {
  // Database
  DB?: D1Database;

  // Storage
  R2?: R2Bucket;

  // Monitoring
  LOGS?: KVNamespace;
  METRICS?: KVNamespace;
  ERROR_TRACKING?: KVNamespace;

  // Rate limiting
  RATE_LIMIT_KV?: KVNamespace;

  // Queues
  QUEUE?: Queue<CrawlQueueMessage>;
  DEAD_LETTER_QUEUE?: Queue<DeadLetterMessage>;

  // Configuration
  SITE_URL?: string;

  // Secrets (should be set via environment variables, not wrangler.json)
  INGEST_SECRET?: string;
  CRON_SECRET?: string;
  ADMIN_SECRET?: string;
  RESEND_API_KEY?: string;
  JWT_SECRET?: string;
  JWT_ISSUER?: string;

  // AI API keys
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;

  // Crawler configuration
  INGEST_API_URL?: string;
  CRAWLER_SOURCES_PER_BATCH?: string;
  CRAWLER_ITEMS_PER_SOURCE?: string;
  CRAWLER_CONCURRENCY?: string;
  CRAWLER_MAX_RETRIES?: string;
  JINA_READER_PREFIX?: string;
  JINA_TIMEOUT?: string;

  // Queue configuration
  QUEUE_BATCH_SIZE?: string;
  QUEUE_MAX_RETRIES?: string;
  QUEUE_RETRY_DELAY?: string;

  // Priority configuration
  HIGH_PRIORITY_TYPES?: string;
  MEDIUM_PRIORITY_TYPES?: string;
  LOW_PRIORITY_TYPES?: string;

  // Alerting
  ALERT_WEBHOOK_URL?: string;

  // Security
  ALLOWED_ORIGINS?: string;
  CSP_ENABLED?: string;

  // Logging
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Re-export Env as CloudflareEnv for compatibility.
 */
export type CloudflareEnv = Env;
