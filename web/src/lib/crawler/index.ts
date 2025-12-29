/**
 * Cloudflare Workers Crawler Module
 *
 * A complete RSS crawler implementation for Cloudflare Workers with:
 * - Priority-based cron scheduling
 * - Queue-based processing with retries
 * - AI-powered content analysis
 * - Full-text extraction via Jina Reader
 * - Content deduplication
 *
 * @module crawler
 */

// Export types
export type {
  Source,
  SourceType,
  SourceCategory,
  RssItem,
  RssFeed,
  Analysis,
  ArticleData,
  IngestPayload,
  CrawlMetrics,
  CrawlQueueMessage,
  DeadLetterMessage,
  CrawlerConfig,
  CrawlerHealth,
  CronEvent,
  SourcePriorityValue,
  PrioritySchedule,
} from './types';

// Export configuration
export {
  loadCrawlerConfig,
  getPriorityForType,
  cronToMs,
  validateConfig,
  PRIORITY_SCHEDULES,
} from './config';

// Export RSS parser
export {
  parseRssFeed,
  extractUrl,
  extractPublishedAt,
  extractContent,
  guessContentFormat,
  isValidItem,
  filterAndSortItems,
  extractSourceMetadata,
} from './rss-parser';

// Export Jina fetcher
export {
  fetchFullContent,
  fetchContentWithRetry,
  batchFetchContent,
  checkJinaHealth,
  shouldUseJina,
  JinaFetchError,
} from './jina-fetcher';

// Export AI analysis
export { analyzeArticle, batchAnalyze } from './ai-analysis';

// Export deduplication
export {
  generateContentHash,
  idFromUrl,
  normalizeUrl,
  areUrlsSimilar,
  textSimilarity,
  areTitlesSimilar,
  extractCanonicalUrl,
  deduplicateByUrl,
  deduplicateByTitle,
  deduplicateNearDuplicates,
} from './deduplication';

// Export API client
export {
  postIngest,
  fetchDueSources,
  updateSourceStatus,
  batchIngest,
  recordCrawlMetrics,
} from './api-client';

// Export crawler orchestrator
export { crawlSource, batchCrawlSources, crawlByPriority, extractArticleData } from './crawler';

// Default export for convenience
export { crawlSource as default } from './crawler';
