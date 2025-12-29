import { analyzeArticle } from './ai-analysis';
import { postIngest, updateSourceStatus } from './api-client';
import { fetchContentWithRetry, shouldUseJina, JinaFetchError } from './jina-fetcher';
import {
  parseRssFeed,
  extractUrl,
  extractPublishedAt,
  extractContent,
  guessContentFormat,
  filterAndSortItems,
} from './rss-parser';
import type { ArticleData, CrawlMetrics, CrawlerConfig, Source } from './types';

/**
 * Main crawler orchestrator for Cloudflare Workers.
 * Coordinates RSS parsing, content fetching, AI analysis, and ingestion.
 */

// Minimal D1Database type for Workers environment
type D1Database = {
  prepare: (sql: string) => D1PreparedStatement;
};

type D1PreparedStatement = {
  bind: (...values: Array<unknown>) => D1BoundStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<T[]>;
  run: () => Promise<{ meta: { changed: number; last_row_id: number } }>;
};

type D1BoundStatement = D1PreparedStatement & {
  finalize: () => void;
};

/**
 * Result of crawling a single RSS item.
 */
interface ItemCrawlResult {
  ok: boolean;
  skipped: boolean;
  url: string | null;
  error?: string;
}

/**
 * Crawl a single source and return metrics.
 */
export async function crawlSource(
  config: CrawlerConfig,
  db: D1Database,
  source: Source
): Promise<CrawlMetrics> {
  const startTime = Date.now();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Parse RSS feed
    const feed = await parseRssFeed(source.url);
    const rawItems = feed.items ?? [];

    // Filter and sort items
    const validItems = filterAndSortItems(
      rawItems,
      config.itemsPerSource,
      30 // Max 30 days old
    );

    // Process each item
    for (const item of validItems) {
      const result = await crawlItem(config, db, source, item);

      if (result.ok) {
        ok++;
      } else if (result.skipped) {
        skipped++;
      } else {
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    // Update source status
    await updateSourceStatus(db as any, {
      id: source.id,
      crawledAt: startTime,
      success: failed === 0,
      errorCountDelta: failed,
    });

    return { ok, skipped, failed, total: validItems.length, duration };
  } catch (error) {
    // Update source status with failure
    await updateSourceStatus(db as any, {
      id: source.id,
      crawledAt: startTime,
      success: false,
      errorCountDelta: 1,
    }).catch(() => {
      // Ignore update errors
    });

    throw error;
  }
}

/**
 * Crawl a single RSS item.
 */
async function crawlItem(
  config: CrawlerConfig,
  db: D1Database,
  source: Source,
  item: {
    title?: string;
    link?: string;
    guid?: string;
    pubDate?: string;
    isoDate?: string;
    content?: string;
    contentSnippet?: string;
    'content:encoded'?: string;
  }
): Promise<ItemCrawlResult> {
  // Extract and validate URL
  const url = extractUrl(item);
  const title = item.title?.trim();

  if (!url || !title) {
    return { ok: false, skipped: true, url: null };
  }

  // Check for duplicates in database
  const existing = await checkDuplicate(db, url);
  if (existing) {
    return { ok: false, skipped: true, url };
  }

  // Extract publication date
  const publishedAt = extractPublishedAt(item);

  // Get content from RSS
  let content = extractContent(item);
  let contentFormat = guessContentFormat(content);

  // Fetch full content if needed
  if (shouldUseJina(source.type, source.needCrawl)) {
    try {
      content = await fetchContentWithRetry(config, url, config.maxRetries);
      contentFormat = 'markdown';
    } catch (error) {
      if (error instanceof JinaFetchError) {
        // Use RSS content as fallback
        if (!content) {
          return { ok: false, skipped: false, url, error: error.message };
        }
      } else {
        return { ok: false, skipped: false, url, error: String(error) };
      }
    }
  }

  // Analyze with AI
  const analysis = await analyzeArticle(config, {
    title,
    content,
    sourceName: source.name,
    sourceCategory: source.category,
  });

  // Prepare ingest payload
  const payload = {
    url,
    title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    sourceType: source.type,
    sourceCategory: source.category,
    sourceLanguage: source.language,
    publishedAt,
    crawledAt: Date.now(),
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

  // Send to ingest API
  const result = await postIngest(config, payload);

  if (!result.ok) {
    return { ok: false, skipped: false, url, error: result.error };
  }

  return { ok: true, skipped: false, url };
}

/**
 * Check if an article already exists in the database.
 */
async function checkDuplicate(db: D1Database, url: string): Promise<boolean> {
  const result = await db.prepare('SELECT 1 FROM news WHERE url = ? LIMIT 1').bind(url).first();

  return result !== undefined;
}

/**
 * Batch crawl multiple sources with concurrency control.
 */
export async function batchCrawlSources(
  config: CrawlerConfig,
  db: D1Database,
  sources: Source[]
): Promise<{
  metrics: Map<string, CrawlMetrics>;
  total: { ok: number; skipped: number; failed: number; total: number };
}> {
  const metrics = new Map<string, CrawlMetrics>();
  const total = { ok: 0, skipped: 0, failed: 0, total: 0 };

  // Process sources in batches with concurrency control
  for (let i = 0; i < sources.length; i += config.concurrency) {
    const batch = sources.slice(i, i + config.concurrency);

    const results = await Promise.allSettled(
      batch.map(async (source) => {
        try {
          const sourceMetrics = await crawlSource(config, db, source);
          metrics.set(source.id, sourceMetrics);
          return { sourceId: source.id, metrics: sourceMetrics };
        } catch (error) {
          // Return failure metrics
          const failureMetrics: CrawlMetrics = {
            ok: 0,
            skipped: 0,
            failed: 0,
            total: 0,
            duration: 0,
          };
          metrics.set(source.id, failureMetrics);
          throw error;
        }
      })
    );

    // Aggregate totals
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const m = result.value.metrics;
        total.ok += m.ok;
        total.skipped += m.skipped;
        total.failed += m.failed;
        total.total += m.total;
      } else {
        total.failed++;
      }
    }
  }

  return { metrics, total };
}

/**
 * Crawl sources by priority level.
 */
export async function crawlByPriority(
  config: CrawlerConfig,
  db: D1Database,
  priority: 'high' | 'medium' | 'low'
): Promise<{
  sources: Source[];
  metrics: Map<string, CrawlMetrics>;
  total: { ok: number; skipped: number; failed: number; total: number };
}> {
  // Get source types for this priority
  const sourceTypes =
    priority === 'high'
      ? config.highPriorityTypes
      : priority === 'medium'
        ? config.mediumPriorityTypes
        : config.lowPriorityTypes;

  // Fetch due sources
  const sources = await fetchSourcesByPriority(db, sourceTypes, config.sourcesPerBatch);

  if (sources.length === 0) {
    return {
      sources: [],
      metrics: new Map(),
      total: { ok: 0, skipped: 0, failed: 0, total: 0 },
    };
  }

  // Batch crawl
  const result = await batchCrawlSources(config, db, sources);

  return {
    sources,
    metrics: result.metrics,
    total: result.total,
  };
}

/**
 * Fetch sources by priority (type).
 */
async function fetchSourcesByPriority(
  db: D1Database,
  sourceTypes: string[],
  limit: number
): Promise<Source[]> {
  const now = Date.now();
  const placeholders = sourceTypes.map(() => '?').join(',');

  const query = `
    SELECT
      id, name, url, type, category, language,
      crawl_frequency,
      need_crawl,
      last_crawled_at,
      error_count
    FROM sources
    WHERE is_active = 1
      AND type IN (${placeholders})
      AND (last_crawled_at IS NULL OR (last_crawled_at + (crawl_frequency * 1000)) <= ?)
    ORDER BY error_count ASC, COALESCE(last_crawled_at, 0) ASC
    LIMIT ?
  `;

  const bindParams = [...sourceTypes, now, limit];

  const result = await db
    .prepare(query)
    .bind(...bindParams)
    .all();

  if (!result || result.length === 0) {
    return [];
  }

  return result.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      name: String(r.name),
      url: String(r.url),
      type: String(r.type) as Source['type'],
      category: r.category === null || r.category === undefined ? null : String(r.category),
      language: r.language === null || r.language === undefined ? null : String(r.language),
      crawlFrequency: Number(r.crawl_frequency ?? 3600),
      needCrawl: Number(r.need_crawl ?? 0) === 1,
      lastCrawledAt:
        r.last_crawled_at === null || r.last_crawled_at === undefined
          ? null
          : Number(r.last_crawled_at),
      errorCount: Number(r.error_count ?? 0),
    } as Source;
  }) as Source[];
}

/**
 * Extract article data for queue processing.
 */
export async function extractArticleData(
  config: CrawlerConfig,
  source: Source,
  item: {
    title?: string;
    link?: string;
    guid?: string;
    pubDate?: string;
    isoDate?: string;
    content?: string;
    contentSnippet?: string;
    'content:encoded'?: string;
  }
): Promise<ArticleData | null> {
  const url = extractUrl(item);
  const title = item.title?.trim();

  if (!url || !title) {
    return null;
  }

  const publishedAt = extractPublishedAt(item);
  let content = extractContent(item);
  let contentFormat = guessContentFormat(content);

  // Fetch full content if needed
  if (shouldUseJina(source.type, source.needCrawl)) {
    try {
      content = await fetchContentWithRetry(config, url, config.maxRetries);
      contentFormat = 'markdown';
    } catch {
      // Use RSS content as fallback
    }
  }

  // Analyze
  const analysis = await analyzeArticle(config, {
    title,
    content,
    sourceName: source.name,
    sourceCategory: source.category,
  });

  return {
    url,
    title,
    sourceId: source.id,
    sourceName: source.name,
    sourceCategory: source.category,
    sourceType: source.type,
    sourceLanguage: source.language,
    publishedAt,
    crawledAt: Date.now(),
    content,
    contentFormat,
    analysis,
  };
}
