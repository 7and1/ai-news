-- =============================================================================
-- Migration: 20250129_120100_add_search_analytics.sql
-- Description: Add search analytics tables
-- Author: CI/CD System
-- Created: 2025-01-29
-- =============================================================================

-- Search queries tracking
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  clicked_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (clicked_id) REFERENCES news(id)
);

CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries(query);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON search_queries(created_at DESC);

-- Popular searches aggregate
CREATE TABLE IF NOT EXISTS popular_searches (
  query TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  last_searched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_popular_searches_count ON popular_searches(count DESC);
CREATE INDEX IF NOT EXISTS idx_popular_searches_last_searched ON popular_searches(last_searched_at DESC);

-- Search suggestions cache
CREATE TABLE IF NOT EXISTS search_suggestions (
  id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  type TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_search_suggestions_prefix ON search_suggestions(prefix, score DESC);
