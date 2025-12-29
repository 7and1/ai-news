/**
 * Type definitions for the Cloudflare Workers crawler.
 * Ported from the Docker crawler with Cloudflare-specific enhancements.
 */

/**
 * Source information from the database.
 */
export interface Source {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  category: SourceCategory | null;
  language: string | null;
  crawlFrequency: number; // in seconds
  needCrawl: boolean;
  lastCrawledAt: number | null;
  errorCount: number;
}

/**
 * Source type enumeration.
 */
export type SourceType =
  | 'article'
  | 'podcast'
  | 'twitter'
  | 'video'
  | 'blog'
  | 'newsletter'
  | 'wechat'
  | 'news';

/**
 * Source category enumeration.
 */
export type SourceCategory =
  | 'ai_company'
  | 'ai_media'
  | 'ai_kol'
  | 'ai_tool'
  | 'programming'
  | 'product'
  | 'design'
  | 'business'
  | 'career'
  | null;

/**
 * Parsed RSS item.
 */
export interface RssItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  author?: string;
  categories?: string[];
}

/**
 * Parsed RSS feed.
 */
export interface RssFeed {
  title?: string;
  description?: string;
  link?: string;
  items?: RssItem[];
}

/**
 * AI analysis result.
 */
export interface Analysis {
  summary: string | null;
  oneLine: string | null;
  category: string | null;
  tags: string[];
  importance: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative';
  language: 'en' | 'zh';
}

/**
 * Article data ready for ingestion.
 */
export interface ArticleData {
  url: string;
  title: string;
  sourceId: string;
  sourceName: string;
  sourceCategory: SourceCategory | null;
  sourceType: SourceType;
  sourceLanguage: string | null;
  publishedAt: number;
  crawledAt: number;
  content: string;
  contentFormat: 'markdown' | 'html' | 'text';
  analysis: Analysis;
}

/**
 * Ingest payload sent to the ingest API.
 */
export interface IngestPayload {
  id?: string;
  url: string;
  title: string;
  sourceId: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceCategory?: string | null;
  sourceLanguage?: string | null;
  publishedAt: number;
  crawledAt?: number;
  summary?: string | null;
  oneLine?: string | null;
  content?: string | null;
  contentFormat?: 'markdown' | 'html' | 'text';
  category?: string | null;
  tags?: string[];
  importance?: number;
  sentiment?: string | null;
  language?: string | null;
  ogImage?: string | null;
}

/**
 * Crawler metrics for a single source.
 */
export interface CrawlMetrics {
  ok: number;
  skipped: number;
  failed: number;
  total: number;
  duration: number;
}

/**
 * Queue message for processing RSS items.
 */
export interface CrawlQueueMessage {
  sourceId: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: SourceType;
  sourceCategory: SourceCategory | null;
  sourceLanguage: string | null;
  itemUrl: string;
  itemTitle: string;
  itemPubDate: string | null;
  itemContent: string;
  needCrawl: boolean;
  timestamp: number;
}

/**
 * Dead letter queue message for failed items.
 */
export interface DeadLetterMessage {
  originalMessage: CrawlQueueMessage;
  error: string;
  retryCount: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

/**
 * Crawler configuration.
 */
export interface CrawlerConfig {
  // Ingest API settings
  ingestApiUrl: string;
  ingestSecret: string;

  // Source settings
  sourcesPerBatch: number;
  itemsPerSource: number;

  // Concurrency settings
  concurrency: number;
  maxRetries: number;

  // AI analysis settings
  anthropicApiKey?: string;
  anthropicModel: string;
  geminiApiKey?: string;
  geminiModel: string;

  // Full-text fetching
  jinaReaderPrefix: string;
  jinaTimeout: number;

  // Queue settings
  queueBatchSize: number;
  queueMaxRetries: number;
  queueRetryDelay: number;

  // Source type priorities (for cron scheduling)
  highPriorityTypes: SourceType[];
  mediumPriorityTypes: SourceType[];
  lowPriorityTypes: SourceType[];
}

/**
 * Crawler health status.
 */
export interface CrawlerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCrawlAt: number | null;
  sourcesProcessed: number;
  articlesIngested: number;
  errors: number;
  averageCrawlTime: number | null;
}

/**
 * Source priority level.
 */
export type SourcePriorityValue = 'high' | 'medium' | 'low';

/**
 * Priority-based cron schedule.
 */
export interface PrioritySchedule {
  priority: SourcePriorityValue;
  cronExpression: string;
  description: string;
}

/**
 * Cron event payload.
 */
export interface CronEvent {
  cron: string;
  scheduledTime?: number;
}

/**
 * Source priority levels for scheduling.
 */
export type SourcePriority = 'high' | 'medium' | 'low';

/**
 * Priority-based cron schedule.
 */
export interface PrioritySchedule {
  priority: SourcePriority;
  cronExpression: string;
  description: string;
}
