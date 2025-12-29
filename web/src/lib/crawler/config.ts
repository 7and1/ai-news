/**
 * Crawler configuration management.
 * Loads configuration from Cloudflare environment variables.
 */

import type { CrawlerConfig, PrioritySchedule } from './types';

/**
 * Default crawler configuration values.
 */
const DEFAULTS = {
  sourcesPerBatch: 50,
  itemsPerSource: 20,
  concurrency: 5,
  maxRetries: 3,
  anthropicModel: 'claude-3-5-haiku-20241022',
  geminiModel: 'gemini-1.5-flash-001',
  jinaReaderPrefix: 'https://r.jina.ai/http://',
  jinaTimeout: 30000,
  queueBatchSize: 10,
  queueMaxRetries: 5,
  queueRetryDelay: 60000,
  highPriorityTypes: ['article', 'blog', 'news'],
  mediumPriorityTypes: ['podcast', 'video'],
  lowPriorityTypes: ['twitter', 'newsletter', 'wechat'],
} as const;

/**
 * Priority-based cron schedules.
 */
export const PRIORITY_SCHEDULES: PrioritySchedule[] = [
  {
    priority: 'high' as const,
    cronExpression: '5 * * * *', // Every hour (minute 5)
    description: 'High-priority sources (articles, blogs, news)',
  },
  {
    priority: 'medium' as const,
    cronExpression: '10 */3 * * *', // Every 3 hours (minute 10)
    description: 'Medium-priority sources (podcasts, videos)',
  },
  {
    priority: 'low' as const,
    cronExpression: '15 */6 * * *', // Every 6 hours (minute 15)
    description: 'Low-priority sources (Twitter, newsletters, WeChat)',
  },
];

/**
 * Get the ingest API URL from environment.
 * Falls back to SITE_URL or localhost for development.
 */
function getIngestApiUrl(env: CloudflareEnv): string {
  if (env.INGEST_API_URL) {
    return env.INGEST_API_URL;
  }

  const siteUrl = env.SITE_URL || 'http://localhost:3000';
  // Remove trailing slash and append ingest endpoint
  return siteUrl.replace(/\/$/, '') + '/api/ingest';
}

/**
 * Load crawler configuration from Cloudflare environment.
 */
export function loadCrawlerConfig(env: CloudflareEnv): CrawlerConfig {
  return {
    ingestApiUrl: getIngestApiUrl(env),
    ingestSecret: env.INGEST_SECRET || '',

    sourcesPerBatch: parseInt(env.CRAWLER_SOURCES_PER_BATCH || `${DEFAULTS.sourcesPerBatch}`, 10),
    itemsPerSource: parseInt(env.CRAWLER_ITEMS_PER_SOURCE || `${DEFAULTS.itemsPerSource}`, 10),
    concurrency: parseInt(env.CRAWLER_CONCURRENCY || `${DEFAULTS.concurrency}`, 10),
    maxRetries: parseInt(env.CRAWLER_MAX_RETRIES || `${DEFAULTS.maxRetries}`, 10),

    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.ANTHROPIC_MODEL || DEFAULTS.anthropicModel,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL || DEFAULTS.geminiModel,

    jinaReaderPrefix: env.JINA_READER_PREFIX || DEFAULTS.jinaReaderPrefix,
    jinaTimeout: parseInt(env.JINA_TIMEOUT || `${DEFAULTS.jinaTimeout}`, 10),

    queueBatchSize: parseInt(env.QUEUE_BATCH_SIZE || `${DEFAULTS.queueBatchSize}`, 10),
    queueMaxRetries: parseInt(env.QUEUE_MAX_RETRIES || `${DEFAULTS.queueMaxRetries}`, 10),
    queueRetryDelay: parseInt(env.QUEUE_RETRY_DELAY || `${DEFAULTS.queueRetryDelay}`, 10),

    highPriorityTypes: (env.HIGH_PRIORITY_TYPES?.split(',') || DEFAULTS.highPriorityTypes) as Array<
      'article' | 'blog' | 'news'
    >,
    mediumPriorityTypes: (env.MEDIUM_PRIORITY_TYPES?.split(',') ||
      DEFAULTS.mediumPriorityTypes) as Array<'podcast' | 'video'>,
    lowPriorityTypes: (env.LOW_PRIORITY_TYPES?.split(',') || DEFAULTS.lowPriorityTypes) as Array<
      'twitter' | 'newsletter' | 'wechat'
    >,
  };
}

/**
 * Get priority level for a source type.
 */
export function getPriorityForType(type: string, config: CrawlerConfig): 'high' | 'medium' | 'low' {
  if (config.highPriorityTypes.includes(type as any)) {
    return 'high';
  }
  if (config.mediumPriorityTypes.includes(type as any)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Parse cron expression to get interval in milliseconds.
 */
export function cronToMs(cron: string): number {
  // Simple parser for "*/N * * * *" format
  const parts = cron.split(' ');
  const minutePart = parts[0];

  if (minutePart?.startsWith('*/')) {
    const interval = parseInt(minutePart.slice(2), 10);
    return interval * 60 * 1000;
  }

  if (minutePart === '0') {
    // Check hour part
    const hourPart = parts[1];
    if (hourPart?.startsWith('*/')) {
      const interval = parseInt(hourPart.slice(2), 10);
      return interval * 60 * 60 * 1000;
    }
  }

  // Default: hourly
  return 60 * 60 * 1000;
}

/**
 * Validate configuration.
 */
export function validateConfig(config: CrawlerConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.ingestSecret) {
    errors.push('INGEST_SECRET is required');
  }

  if (!config.ingestApiUrl) {
    errors.push('Ingest API URL is required');
  }

  if (config.sourcesPerBatch < 1 || config.sourcesPerBatch > 500) {
    errors.push('CRAWLER_SOURCES_PER_BATCH must be between 1 and 500');
  }

  if (config.itemsPerSource < 1 || config.itemsPerSource > 100) {
    errors.push('CRAWLER_ITEMS_PER_SOURCE must be between 1 and 100');
  }

  if (config.concurrency < 1 || config.concurrency > 50) {
    errors.push('CRAWLER_CONCURRENCY must be between 1 and 50');
  }

  if (config.jinaTimeout < 1000 || config.jinaTimeout > 120000) {
    errors.push('JINA_TIMEOUT must be between 1000 and 120000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
