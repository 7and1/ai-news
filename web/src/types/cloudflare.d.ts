import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

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

declare global {
  interface CloudflareEnv {
    // Database bindings
    DB?: D1Database;
    R2?: R2Bucket;

    // Monitoring & Logging
    LOGS?: KVNamespace;
    METRICS?: KVNamespace;
    ERROR_TRACKING?: KVNamespace;

    // Performance & Caching
    WEB_VITALS_KV?: KVNamespace;
    QUERY_CACHE?: KVNamespace;

    // Queue bindings
    QUEUE?: Queue<CrawlQueueMessage>;
    DEAD_LETTER_QUEUE?: Queue<DeadLetterMessage>;

    // Alerting
    ALERT_WEBHOOK_URL?: string;

    // Configuration
    SITE_URL?: string;

    // Secret credentials (use environment variables, not wrangler.json)
    INGEST_SECRET?: string;
    INGEST_API_URL?: string;
    CRON_SECRET?: string;
    ADMIN_SECRET?: string;
    ADMIN_API_KEY?: string;
    RESEND_API_KEY?: string;
    JWT_SECRET?: string;
    JWT_ISSUER?: string;

    // AI API keys (use environment variables)
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;

    // Crawler configuration
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

    // Rate limiting
    RATE_LIMIT_KV?: KVNamespace;
    RATE_LIMIT_ENABLED?: string;
    RATE_LIMIT_PUBLIC_REQUESTS?: string;
    RATE_LIMIT_PUBLIC_WINDOW?: string;
    RATE_LIMIT_SEARCH_REQUESTS?: string;
    RATE_LIMIT_SEARCH_WINDOW?: string;
    RATE_LIMIT_INGEST_REQUESTS?: string;
    RATE_LIMIT_INGEST_WINDOW?: string;
    RATE_LIMIT_ADMIN_REQUESTS?: string;
    RATE_LIMIT_ADMIN_WINDOW?: string;
    RATE_LIMIT_ITEM_REQUESTS?: string;
    RATE_LIMIT_ITEM_WINDOW?: string;

    // Security configuration
    ALLOWED_ORIGINS?: string;
    CSP_ENABLED?: string;

    // Logging
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  }
}

export {};
