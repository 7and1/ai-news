/**
 * API client for communicating with the BestBlogs ingest API.
 */

import type { CrawlerConfig, IngestPayload } from './types';

type D1Database = {
  prepare: (sql: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<Array<{ error?: string }>>;
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
 * Post article data to the ingest API.
 */
export async function postIngest(
  config: CrawlerConfig,
  payload: IngestPayload
): Promise<{ ok: true; id: string; inserted: boolean } | { ok: false; error: string }> {
  try {
    const response = await fetch(config.ingestApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-secret': config.ingestSecret,
        'user-agent': 'BestBlogs-Crawler/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Ingest failed: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      id: data.id,
      inserted: data.inserted ?? true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch sources that are due for crawling.
 */
export async function fetchDueSources(
  config: CrawlerConfig,
  db: D1Database,
  options: {
    limit?: number;
    sourceTypes?: string[];
    priority?: 'high' | 'medium' | 'low';
  } = {}
): Promise<
  Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    category: string | null;
    language: string | null;
    crawlFrequency: number;
    needCrawl: boolean;
    lastCrawledAt: number | null;
    errorCount: number;
  }>
> {
  const now = Date.now();
  const limit = options.limit ?? config.sourcesPerBatch;

  let whereClause =
    'is_active = 1 AND (last_crawled_at IS NULL OR (last_crawled_at + (crawl_frequency * 1000)) <= ?)';
  const bindParams: (string | number)[] = [now];

  // Filter by source types if specified
  if (options.sourceTypes && options.sourceTypes.length > 0) {
    const placeholders = options.sourceTypes.map(() => '?').join(',');
    whereClause += ` AND type IN (${placeholders})`;
    bindParams.push(...options.sourceTypes);
  }

  // Order by error count (ascending) and last crawled (ascending)
  // This gives priority to sources that have been working well and haven't been crawled recently
  const query = `
    SELECT
      id, name, url, type, category, language,
      crawl_frequency,
      need_crawl,
      last_crawled_at,
      error_count
    FROM sources
    WHERE ${whereClause}
    ORDER BY error_count ASC, COALESCE(last_crawled_at, 0) ASC
    LIMIT ?
  `;

  bindParams.push(limit);

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
      type: String(r.type),
      category: r.category === null || r.category === undefined ? null : String(r.category),
      language: r.language === null || r.language === undefined ? null : String(r.language),
      crawlFrequency: Number(r.crawl_frequency ?? 3600),
      needCrawl: Number(r.need_crawl ?? 0) === 1,
      lastCrawledAt:
        r.last_crawled_at === null || r.last_crawled_at === undefined
          ? null
          : Number(r.last_crawled_at),
      errorCount: Number(r.error_count ?? 0),
    };
  });
}

/**
 * Update source crawl status after processing.
 */
export async function updateSourceStatus(
  db: D1Database,
  input: {
    id: string;
    crawledAt: number;
    success: boolean;
    errorCountDelta?: number;
  }
): Promise<void> {
  const delta = input.errorCountDelta ?? (input.success ? 0 : 1);

  await db
    .prepare(
      `
      UPDATE sources
      SET
        last_crawled_at = ?,
        last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
        error_count = CASE
          WHEN ? THEN 0
          ELSE COALESCE(error_count, 0) + ?
        END
      WHERE id = ?
    `
    )
    .bind(
      input.crawledAt,
      input.success ? 1 : 0,
      input.crawledAt,
      input.success ? 1 : 0,
      delta,
      input.id
    )
    .run();
}

/**
 * Batch ingest multiple articles.
 */
export async function batchIngest(
  config: CrawlerConfig,
  payloads: IngestPayload[]
): Promise<{
  successful: Array<{ id: string; inserted: boolean }>;
  failed: Array<{ payload: IngestPayload; error: string }>;
}> {
  const successful: Array<{ id: string; inserted: boolean }> = [];
  const failed: Array<{ payload: IngestPayload; error: string }> = [];

  // Process sequentially to avoid overwhelming the API
  for (const payload of payloads) {
    const result = await postIngest(config, payload);
    if (result.ok) {
      successful.push({ id: result.id, inserted: result.inserted });
    } else {
      failed.push({ payload, error: result.error });
    }
  }

  return { successful, failed };
}

/**
 * Record crawl metrics to database.
 */
export async function recordCrawlMetrics(
  db: D1Database,
  _sourceId: string,
  metrics: {
    crawledAt: number;
    itemCount: number;
    successCount: number;
    failureCount: number;
    duration: number;
  }
): Promise<void> {
  // Store in a metrics table or log for analytics
  // For now, we'll use the stats table if it exists
  const date = new Date(metrics.crawledAt).toISOString().split('T')[0];

  await db
    .prepare(
      `
      INSERT INTO stats (date, crawl_success, crawl_error)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        crawl_success = crawl_success + excluded.crawl_success,
        crawl_error = crawl_error + excluded.crawl_error
    `
    )
    .bind(date, metrics.successCount, metrics.failureCount)
    .run()
    .catch(() => {
      // Stats table might not exist, ignore error
    });
}
