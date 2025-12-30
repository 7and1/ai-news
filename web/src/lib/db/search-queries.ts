import { getDb } from '@/lib/d1';

import { decodeCursor, encodeCursor } from './cursor';
import { mapNewsRow, toListItem } from './row';
import type { NewsListItem } from './types';

// ============================================================================
// Types
// ============================================================================

export type SearchField = 'all' | 'title' | 'summary' | 'content' | 'tags';
export type SearchOperator = 'AND' | 'OR' | 'NOT';
export type SortOrder = 'relevance' | 'newest' | 'oldest' | 'importance';

export interface AdvancedSearchParams {
  q: string;
  limit?: number;
  cursor?: string | null;
  // Field filters
  fields?: SearchField[];
  // Facet filters
  category?: string | string[];
  sourceCategory?: string | string[];
  sourceId?: string | string[];
  language?: string | string[];
  tags?: string | string[];
  // Date range
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  // Importance range
  minImportance?: number;
  maxImportance?: number;
  // Sorting
  sortBy?: SortOrder;
}

export interface SearchResult {
  items: NewsListItem[];
  nextCursor: string | null;
  total?: number;
  queryInfo: {
    query: string;
    parsedQuery: string;
    filters: string[];
    hasAdvancedSyntax: boolean;
  };
}

export interface SuggestionResult {
  suggestions: string[];
  types: ('query' | 'title' | 'tag' | 'entity')[];
}

export interface SearchAnalytics {
  queryId: string;
  trackClick: (newsId: string) => Promise<void>;
}

export interface PopularSearchesResult {
  queries: { query: string; count: number }[];
  trending: { query: string; count: number; delta: number }[];
}

// ============================================================================
// Query Parser for Advanced Search
// ============================================================================

interface ParsedQuery {
  ftsQuery: string;
  filters: {
    category?: string[];
    source?: string[];
    tag?: string[];
    language?: string[];
    dateAfter?: string;
    dateBefore?: string;
  };
  hasPhrase: boolean;
  hasWildcard: boolean;
  hasBoolean: boolean;
}

/**
 * Parse search query with support for:
 * - Phrase search: "exact phrase"
 * - Wildcards: word* (prefix matching)
 * - Boolean operators: AND, OR, NOT (case-insensitive)
 * - Field-specific search: title:term, tag:term, etc.
 * - Filter syntax: category:ai, language:en
 * - Date ranges: after:2024-01-01, before:2024-12-31
 */
function parseAdvancedQuery(query: string, fields: SearchField[] = ['all']): ParsedQuery {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ftsQuery: '',
      filters: {},
      hasPhrase: false,
      hasWildcard: false,
      hasBoolean: false,
    };
  }

  // Extract quoted phrases first
  const phrases: string[] = [];
  let processed = trimmed.replace(/"([^"]+)"/g, (_, phrase) => {
    phrases.push(phrase);
    return `__PHRASE_${phrases.length - 1}__`;
  });

  // Extract filters
  const filters: ParsedQuery['filters'] = {};

  // Category filter: category:ai or cat:ai
  processed = processed.replace(/\b(?:category|cat):([^\s]+)/gi, (_, val) => {
    filters.category = filters.category || [];
    filters.category.push(val.toLowerCase());
    return '';
  });

  // Language filter: language:en or lang:en
  processed = processed.replace(/\b(?:language|lang):([^\s]+)/gi, (_, val) => {
    filters.language = filters.language || [];
    filters.language.push(val.toLowerCase());
    return '';
  });

  // Tag filter: tag:opensource
  processed = processed.replace(/\btag:([^\s]+)/gi, (_, val) => {
    filters.tag = filters.tag || [];
    filters.tag.push(val);
    return '';
  });

  // Source filter: source:openai
  processed = processed.replace(/\bsource:([^\s]+)/gi, (_, val) => {
    filters.source = filters.source || [];
    filters.source.push(val.toLowerCase());
    return '';
  });

  // Date filters
  processed = processed.replace(/\bafter:([^\s]+)/gi, (_, val) => {
    filters.dateAfter = val;
    return '';
  });
  processed = processed.replace(/\bbefore:([^\s]+)/gi, (_, val) => {
    filters.dateBefore = val;
    return '';
  });

  // Restore phrases
  processed = processed.replace(/__PHRASE_(\d+)__/g, (_, idx) => {
    return `"${phrases[Number(idx)]}"`;
  });

  // Check for special syntax
  const hasPhrase = /"/.test(processed);
  const hasWildcard = /\*|\?/.test(processed);
  const hasBoolean = /\s+(AND|OR|NOT)\s+/i.test(processed);

  // Build FTS5 query
  let ftsQuery = processed;

  // If no explicit boolean operators, treat as AND by default
  if (!hasBoolean && !hasPhrase) {
    // Tokenize and add implicit AND
    const tokens = ftsQuery
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .map((t) => {
        // Support trailing wildcard
        if (t.endsWith('*')) {
          return t;
        }
        // Add prefix matching for partial terms
        return `${t}*`;
      });
    ftsQuery = tokens.join(' AND ');
  }

  // Handle wildcards properly - FTS5 supports prefix matching with *
  ftsQuery = ftsQuery.replace(/\?/g, ''); // Remove ? (not supported in FTS5)

  // Apply field restrictions
  const fieldColumns: string[] = [];
  if (fields.includes('all')) {
    fieldColumns.push('title', 'summary', 'content', 'tags');
  } else {
    if (fields.includes('title')) {
      fieldColumns.push('title');
    }
    if (fields.includes('summary')) {
      fieldColumns.push('summary');
    }
    if (fields.includes('content')) {
      fieldColumns.push('content');
    }
    if (fields.includes('tags')) {
      fieldColumns.push('tags');
    }
  }

  // For FTS5, we can use column-specific queries like: title:term OR summary:term
  if (fieldColumns.length === 1) {
    ftsQuery = `${fieldColumns[0]}:${ftsQuery}`;
  } else if (fields.includes('all') && !hasBoolean) {
    // Boost title matches by querying title first, then others
    ftsQuery = `(title: ${ftsQuery}) OR (summary: ${ftsQuery}) OR (content: ${ftsQuery})`;
  }

  return {
    ftsQuery: ftsQuery.trim(),
    filters,
    hasPhrase,
    hasWildcard,
    hasBoolean,
  };
}

/**
 * Parse date string to timestamp
 */
function parseDateToTimestamp(dateStr: string): number {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 0;
    }
    return date.getTime();
  } catch {
    return 0;
  }
}

// ============================================================================
// Advanced Search
// ============================================================================

/**
 * Advanced search with custom relevance scoring
 */
export async function advancedSearch(params: AdvancedSearchParams): Promise<SearchResult> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(50, params.limit ?? 30));
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const fields = params.fields ?? ['all'];

  // Parse the query
  const parsed = parseAdvancedQuery(params.q, fields);

  // Combine URL filters with query filters
  const filterClauses: string[] = [];
  const filterBinds: unknown[] = [];

  // Category filters
  const categories = params.category
    ? Array.isArray(params.category)
      ? params.category
      : [params.category]
    : parsed.filters.category;
  if (categories && categories.length > 0) {
    const placeholders = categories.map(() => '?').join(',');
    filterClauses.push(`(n.category IS NULL OR n.category IN (${placeholders}))`);
    filterBinds.push(...categories);
  }

  // Source category filters
  if (params.sourceCategory) {
    const sourceCats = Array.isArray(params.sourceCategory)
      ? params.sourceCategory
      : [params.sourceCategory];
    const placeholders = sourceCats.map(() => '?').join(',');
    filterClauses.push(`(s.category IS NULL OR s.category IN (${placeholders}))`);
    filterBinds.push(...sourceCats);
  }

  // Source ID filters
  if (params.sourceId) {
    const sourceIds = Array.isArray(params.sourceId) ? params.sourceId : [params.sourceId];
    const placeholders = sourceIds.map(() => '?').join(',');
    filterClauses.push(`n.source_id IN (${placeholders})`);
    filterBinds.push(...sourceIds);
  }

  // Language filters
  const languages = params.language
    ? Array.isArray(params.language)
      ? params.language
      : [params.language]
    : parsed.filters.language;
  if (languages && languages.length > 0) {
    const placeholders = languages.map(() => '?').join(',');
    filterClauses.push(`n.language IN (${placeholders})`);
    filterBinds.push(...languages);
  }

  // Tag filters
  if (params.tags) {
    const tags = Array.isArray(params.tags) ? params.tags : [params.tags];
    for (const tag of tags) {
      filterClauses.push(
        `EXISTS (SELECT 1 FROM json_each(COALESCE(n.tags, '[]')) WHERE value = ?)`
      );
      filterBinds.push(tag);
    }
  } else if (parsed.filters.tag && parsed.filters.tag.length > 0) {
    for (const tag of parsed.filters.tag) {
      filterClauses.push(
        `EXISTS (SELECT 1 FROM json_each(COALESCE(n.tags, '[]')) WHERE value = ?)`
      );
      filterBinds.push(tag);
    }
  }

  // Date range filters
  if (params.startDate || parsed.filters.dateAfter) {
    const after = params.startDate
      ? parseDateToTimestamp(params.startDate)
      : parseDateToTimestamp(parsed.filters.dateAfter!);
    if (after > 0) {
      filterClauses.push('n.published_at >= ?');
      filterBinds.push(after);
    }
  }
  if (params.endDate || parsed.filters.dateBefore) {
    const before = params.endDate
      ? parseDateToTimestamp(params.endDate)
      : parseDateToTimestamp(parsed.filters.dateBefore!);
    if (before > 0) {
      filterClauses.push('n.published_at <= ?');
      filterBinds.push(before);
    }
  }

  // Importance range
  if (params.minImportance !== undefined) {
    filterClauses.push('n.importance >= ?');
    filterBinds.push(params.minImportance);
  }
  if (params.maxImportance !== undefined) {
    filterClauses.push('n.importance <= ?');
    filterBinds.push(params.maxImportance);
  }

  // Build the search query
  const sortBy = params.sortBy ?? 'relevance';

  let orderBy: string;
  switch (sortBy) {
    case 'newest':
      orderBy = 'n.published_at DESC, n.importance DESC';
      break;
    case 'oldest':
      orderBy = 'n.published_at ASC, n.importance DESC';
      break;
    case 'importance':
      orderBy = 'n.importance DESC, n.published_at DESC';
      break;
    case 'relevance':
    default:
      // Custom relevance score formula
      // - Boost title matches by 3x
      // - Boost summary matches by 2x
      // - Boost by importance (normalized)
      // - Time decay factor for recency
      orderBy = `
        bm25(news_fts_enhanced, 10.0, 5.0, 2.0, 1.0) * 100 +
        (n.importance * 0.5) +
        CASE
          WHEN n.published_at > ? THEN 10
          WHEN n.published_at > ? THEN 5
          ELSE 0
        END DESC,
        n.published_at DESC
      `;
      break;
  }

  // Build WHERE clause
  const whereClauses: string[] = [];
  const whereBinds: unknown[] = [];

  if (parsed.ftsQuery) {
    whereClauses.push('news_fts_enhanced MATCH ?');
    whereBinds.push(parsed.ftsQuery);
  } else {
    // No search query, just filters
    whereClauses.push('1=1');
  }

  if (cursor) {
    whereClauses.push('(n.published_at < ? OR (n.published_at = ? AND n.id < ?))');
    whereBinds.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
  }

  // Combine all filters
  const allFilters = [...whereClauses, ...filterClauses];
  const allBinds = [...whereBinds, ...filterBinds];

  // Add timestamp binds for relevance scoring (if using relevance sort)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let finalBinds = allBinds;
  if (sortBy === 'relevance') {
    finalBinds = [weekAgo, monthAgo, ...allBinds];
  }

  // Get total count (optional, can be expensive)
  let total: number | undefined;
  if (parsed.ftsQuery) {
    try {
      const countResult = await db
        .prepare(
          `
          SELECT COUNT(*) as total
          FROM news_fts_enhanced
          JOIN news n ON n.id = news_fts_enhanced.id
          JOIN sources s ON s.id = n.source_id
          WHERE ${allFilters.join(' AND ')}
        `
        )
        .bind(...allBinds)
        .first();
      total = Number((countResult as { total?: number })?.total ?? 0);
    } catch {
      // Count may fail on complex queries
      total = undefined;
    }
  }

  const rows = await db
    .prepare(
      `
      SELECT
        n.*,
        s.name AS source_name,
        s.type AS source_type,
        s.category AS source_category,
        bm25(news_fts_enhanced) AS rank_score
      FROM news_fts_enhanced
      JOIN news n ON n.id = news_fts_enhanced.id
      JOIN sources s ON s.id = n.source_id
      WHERE ${allFilters.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ?
    `
    )
    .bind(...finalBinds, limit + 1)
    .all();

  const rawRows = (rows.results ?? []) as Record<string, unknown>[];
  const slice = rawRows.slice(0, limit).map(mapNewsRow).map(toListItem);
  const last = slice.at(-1);
  const nextCursor =
    rawRows.length > limit && last
      ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
      : null;

  return {
    items: slice,
    nextCursor,
    total,
    queryInfo: {
      query: params.q,
      parsedQuery: parsed.ftsQuery,
      filters: [...filterClauses],
      hasAdvancedSyntax: parsed.hasBoolean || parsed.hasPhrase || parsed.hasWildcard,
    },
  };
}

// ============================================================================
// Search Suggestions
// ============================================================================

/**
 * Get search suggestions based on:
 * - Popular searches
 * - Matching article titles
 * - Matching tags
 */
export async function getSearchSuggestions(
  prefix: string,
  limit: number = 10
): Promise<SuggestionResult> {
  const db = await getDb();
  const cleanPrefix = prefix.trim().toLowerCase();
  const suggestions: string[] = [];
  const types: ('query' | 'title' | 'tag' | 'entity')[] = [];

  if (cleanPrefix.length < 2) {
    return { suggestions: [], types: [] };
  }

  // 1. Check popular searches
  const popularRows = await db
    .prepare(
      `
      SELECT query, count
      FROM popular_searches
      WHERE query LIKE ? || '%'
      ORDER BY count DESC, last_searched_at DESC
      LIMIT 4
    `
    )
    .bind(cleanPrefix)
    .all();

  for (const row of popularRows.results ?? []) {
    const r = row as { query: string; count: number };
    if (!suggestions.includes(r.query)) {
      suggestions.push(r.query);
      types.push('query');
    }
  }

  // 2. Match against article titles
  const titleRows = await db
    .prepare(
      `
      SELECT DISTINCT title
      FROM news_fts_enhanced
      WHERE title LIKE ? || '%'
      ORDER BY importance DESC, published_at DESC
      LIMIT 4
    `
    )
    .bind(cleanPrefix)
    .all();

  for (const row of titleRows.results ?? []) {
    const r = row as { title: string };
    // Extract first few words as suggestion
    const words = r.title.split(/\s+/).slice(0, 5).join(' ');
    if (!suggestions.includes(words)) {
      suggestions.push(words);
      types.push('title');
    }
  }

  // 3. Match against tags
  const tagRows = await db
    .prepare(
      `
      SELECT DISTINCT value
      FROM news n, json_each(COALESCE(n.tags, '[]'))
      WHERE LOWER(value) LIKE ? || '%'
      LIMIT 4
    `
    )
    .bind(cleanPrefix)
    .all();

  for (const row of tagRows.results ?? []) {
    const r = row as { value: string };
    if (!suggestions.includes(r.value)) {
      suggestions.push(r.value);
      types.push('tag');
    }
  }

  // 4. Company/entity detection (simple heuristic)
  // Look for capitalized words in titles that start with prefix
  const entityRows = await db
    .prepare(
      `
      SELECT DISTINCT title
      FROM news_fts_enhanced
      WHERE title LIKE ? || '%'
      AND (
        title LIKE '%OpenAI%' OR
        title LIKE '%Google%' OR
        title LIKE '%Microsoft%' OR
        title LIKE '%Anthropic%' OR
        title LIKE '%Meta%' OR
        title LIKE '%Amazon%' OR
        title LIKE '%NVIDIA%'
      )
      LIMIT 3
    `
    )
    .bind(cleanPrefix.charAt(0).toUpperCase() + cleanPrefix.slice(1))
    .all();

  for (const row of entityRows.results ?? []) {
    const r = row as { title: string };
    // Extract potential entity name
    const match = r.title.match(/\b([A-Z][a-zA-Z]{2,})\b/);
    if (match && match[1] && !suggestions.includes(match[1])) {
      suggestions.push(match[1]);
      types.push('entity');
    }
  }

  return {
    suggestions: suggestions.slice(0, limit),
    types: types.slice(0, limit),
  };
}

// ============================================================================
// Search Analytics
// ============================================================================

/**
 * Track a search query
 */
export async function trackSearch(params: {
  query: string;
  resultsCount: number;
}): Promise<string> {
  const db = await getDb();
  const id = nanoid();

  await db
    .prepare(
      `
      INSERT INTO search_queries (id, query, results_count, created_at)
      VALUES (?, ?, ?, unixepoch() * 1000)
    `
    )
    .bind(id, params.query, params.resultsCount)
    .run();

  // Update popular searches asynchronously
  void db
    .prepare(
      `
      INSERT INTO popular_searches (query, count, last_searched_at)
      VALUES (?, 1, unixepoch() * 1000)
      ON CONFLICT(query) DO UPDATE SET
        count = count + 1,
        last_searched_at = unixepoch() * 1000,
        updated_at = unixepoch() * 1000
    `
    )
    .bind(params.query)
    .run()
    .catch(() => {});

  return id;
}

/**
 * Track a search result click
 */
export async function trackSearchClick(params: { queryId: string; newsId: string }): Promise<void> {
  const db = await getDb();

  await db
    .prepare(
      `
      UPDATE search_queries
      SET clicked_id = ?
      WHERE id = ?
    `
    )
    .bind(params.newsId, params.queryId)
    .run();
}

/**
 * Get popular searches
 */
export async function getPopularSearches(limit: number = 20): Promise<PopularSearchesResult> {
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT query, count
      FROM popular_searches
      ORDER BY count DESC, last_searched_at DESC
      LIMIT ?
    `
    )
    .bind(limit)
    .all();

  const queries = (rows.results ?? []) as { query: string; count: number }[];

  return {
    queries: queries.map((r) => ({ query: r.query, count: r.count })),
    trending: queries.map((r) => ({
      query: r.query,
      count: r.count,
      delta: 0,
    })),
  };
}

/**
 * Get zero-result searches (for optimization opportunities)
 */
export async function getZeroResultSearches(
  limit: number = 50
): Promise<{ query: string; count: number; lastSeen: number }[]> {
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT query, COUNT(*) as count, MAX(created_at) as lastSeen
      FROM search_queries
      WHERE results_count = 0
      GROUP BY query
      ORDER BY count DESC
      LIMIT ?
    `
    )
    .bind(limit)
    .all();

  return ((rows.results ?? []) as { query: string; count: number; lastSeen: number }[]).map(
    (r) => ({
      query: r.query,
      count: r.count,
      lastSeen: r.lastSeen,
    })
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID
 */
function nanoid(): string {
  // Simple nanoid implementation
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Extract highlight snippets from search results
 */
export function extractHighlights(
  content: string | null,
  query: string,
  maxSnippets: number = 3
): string[] {
  if (!content) {
    return [];
  }

  const snippets: string[] = [];
  const terms = query
    .toLowerCase()
    .replace(/[+"]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 5);

  if (terms.length === 0) {
    return [];
  }

  // Strip HTML for snippet extraction
  const plainText = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const term of terms) {
    const idx = plainText.toLowerCase().indexOf(term.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(plainText.length, idx + term.length + 40);
      let snippet = plainText.substring(start, end);
      const hasBefore = idx > 0;
      const hasAfter = idx + term.length < plainText.length;
      if (hasBefore) {
        snippet = '...' + snippet;
      }
      if (hasAfter) {
        snippet = snippet + '...';
      }
      snippets.push(snippet);
      if (snippets.length >= maxSnippets) {
        break;
      }
    }
  }

  return snippets;
}

// ============================================================================
// Legacy Search (maintained for backward compatibility)
// ============================================================================

export async function searchNews(input: {
  q: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ items: NewsListItem[]; nextCursor: string | null }> {
  const result = await advancedSearch({
    q: input.q,
    limit: input.limit,
    cursor: input.cursor,
    sortBy: 'relevance',
  });
  return {
    items: result.items,
    nextCursor: result.nextCursor,
  };
}
