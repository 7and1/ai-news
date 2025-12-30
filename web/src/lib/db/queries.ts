import { getDb } from '@/lib/d1';

import { decodeCursor, encodeCursor } from './cursor';
import { mapNewsRow, toListItem } from './row';
import type { News, NewsListItem } from './types';

// Re-export search functions from search-queries module
export {
  searchNews,
  advancedSearch,
  getSearchSuggestions,
  trackSearch,
  trackSearchClick,
  getPopularSearches,
  getZeroResultSearches,
  extractHighlights,
  type SearchField,
  type SearchOperator,
  type SortOrder,
  type AdvancedSearchParams,
  type SearchResult,
  type SuggestionResult,
  type SearchAnalytics,
  type PopularSearchesResult,
} from './search-queries';

export type ListNewsInput = {
  limit?: number;
  cursor?: string | null;
  minImportance?: number;
  language?: string | null;
  category?: string | null;
  sourceCategory?: string | null;
  tag?: string | null;
};

export async function getNewsById(id: string): Promise<News | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `
      SELECT
        n.*,
        s.name AS source_name,
        s.type AS source_type,
        s.category AS source_category
      FROM news n
      JOIN sources s ON s.id = n.source_id
      WHERE n.id = ?
      LIMIT 1
    `
    )
    .bind(id)
    .first();

  if (!row) {
    return null;
  }
  return mapNewsRow(row as Record<string, unknown>);
}

function clampLimit(limit: number | undefined, max: number) {
  const n = limit ?? 30;
  return Math.max(1, Math.min(max, n));
}

export async function listNews(input: ListNewsInput = {}): Promise<{
  items: NewsListItem[];
  nextCursor: string | null;
}> {
  const db = await getDb();
  const limit = clampLimit(input.limit, 50);
  const minImportance = input.minImportance ?? 0;
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;

  const where: string[] = ['n.importance >= ?'];
  const binds: unknown[] = [minImportance];

  if (input.language) {
    where.push('n.language = ?');
    binds.push(input.language);
  }
  if (input.category) {
    where.push('n.category = ?');
    binds.push(input.category);
  }
  if (input.sourceCategory) {
    where.push('s.category = ?');
    binds.push(input.sourceCategory);
  }
  if (input.tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(COALESCE(n.tags, '[]')) WHERE value = ?)");
    binds.push(input.tag);
  }
  if (cursor) {
    where.push('(n.published_at < ? OR (n.published_at = ? AND n.id < ?))');
    binds.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
  }

  const rows = await db
    .prepare(
      `
      SELECT
        n.*,
        s.name AS source_name,
        s.type AS source_type,
        s.category AS source_category
      FROM news n
      JOIN sources s ON s.id = n.source_id
      WHERE ${where.join(' AND ')}
      ORDER BY n.published_at DESC, n.id DESC
      LIMIT ?
    `
    )
    .bind(...binds, limit + 1)
    .all();

  const rawRows = (rows.results ?? []) as Record<string, unknown>[];
  const slice = rawRows.slice(0, limit).map(mapNewsRow).map(toListItem);
  const last = slice.at(-1);
  const nextCursor =
    rawRows.length > limit && last
      ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
      : null;

  return { items: slice, nextCursor };
}

export type NewsEntities = {
  companies: string[];
  models: string[];
  technologies: string[];
  concepts: string[];
};

export type UpsertNewsInput = {
  id: string;
  title: string;
  summary?: string | null;
  oneLine?: string | null;
  content?: string | null;
  url: string;
  sourceId: string;
  category?: string | null;
  tags?: string[] | null;
  importance?: number | null;
  sentiment?: string | null;
  language?: string | null;
  ogImage?: string | null;
  publishedAt: number;
  crawledAt: number;
  entities?: NewsEntities | null;
};

export async function upsertNews(input: UpsertNewsInput): Promise<{
  inserted: boolean;
  id: string;
}> {
  const db = await getDb();
  const tags = JSON.stringify(input.tags ?? []);
  const entities = input.entities ? JSON.stringify(input.entities) : null;
  const importance =
    input.importance === null || input.importance === undefined
      ? 50
      : Math.max(0, Math.min(100, input.importance));
  const language = input.language ?? 'en';

  const result = await db
    .prepare(
      `
      INSERT INTO news (
        id, title, summary, one_line, content, url, source_id,
        category, tags, importance, sentiment, language, og_image,
        published_at, crawled_at, entities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        one_line = excluded.one_line,
        content = excluded.content,
        source_id = excluded.source_id,
        category = excluded.category,
        tags = excluded.tags,
        importance = excluded.importance,
        sentiment = excluded.sentiment,
        language = excluded.language,
        og_image = excluded.og_image,
        published_at = excluded.published_at,
        crawled_at = excluded.crawled_at,
        entities = excluded.entities
    `
    )
    .bind(
      input.id,
      input.title,
      input.summary ?? null,
      input.oneLine ?? null,
      input.content ?? null,
      input.url,
      input.sourceId,
      input.category ?? null,
      tags,
      importance,
      input.sentiment ?? null,
      language,
      input.ogImage ?? null,
      input.publishedAt,
      input.crawledAt,
      entities
    )
    .run();

  return { inserted: (result.meta?.changes ?? 0) > 0, id: input.id };
}

export async function listTopTags(input: {
  limit?: number;
  minImportance?: number;
}): Promise<{ tag: string; count: number }[]> {
  const db = await getDb();
  const limit = clampLimit(input.limit, 30);
  const minImportance = input.minImportance ?? 50;

  const rows = await db
    .prepare(
      `
      SELECT value AS tag, COUNT(1) AS count
      FROM news n, json_each(COALESCE(n.tags, '[]'))
      WHERE n.importance >= ?
      GROUP BY value
      ORDER BY count DESC
      LIMIT ?
    `
    )
    .bind(minImportance, limit)
    .all();

  const results = (rows.results ?? []) as { tag: string; count: number }[];
  return results.map((r) => ({ tag: String(r.tag), count: Number(r.count) }));
}

export async function listDueSources(input?: { now?: number; limit?: number }): Promise<
  {
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
  }[]
> {
  const db = await getDb();
  const now = input?.now ?? Date.now();
  const limit = clampLimit(input?.limit, 200);

  const rows = await db
    .prepare(
      `
      SELECT
        id, name, url, type, category, language,
        crawl_frequency,
        need_crawl,
        last_crawled_at,
        error_count
      FROM sources
      WHERE is_active = 1
        AND (
          last_crawled_at IS NULL
          OR (last_crawled_at + (crawl_frequency * 1000)) <= ?
        )
      ORDER BY COALESCE(last_crawled_at, 0) ASC
      LIMIT ?
    `
    )
    .bind(now, limit)
    .all();

  const results = (rows.results ?? []) as {
    id: string;
    name: string;
    url: string;
    type: string;
    category: string | null;
    language: string | null;
    crawl_frequency: number;
    need_crawl: number;
    last_crawled_at: number | null;
    error_count: number;
  }[];

  return results.map((r) => ({
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
  }));
}

export async function updateSourceCrawlStatus(input: {
  id: string;
  crawledAt: number;
  success: boolean;
  errorCountDelta?: number;
}) {
  const db = await getDb();
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
