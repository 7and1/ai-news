-- =============================================================================
-- PERFORMANCE INDEXES for BestBlogs.dev
-- =============================================================================
-- These indexes optimize common query patterns for better performance
-- Run this after the main schema migration

-- Composite index for news listing (most common query)
-- Covers: ORDER BY published_at DESC, WHERE importance >= X, WHERE language = X
CREATE INDEX IF NOT EXISTS idx_news_published_importance 
  ON news(published_at DESC, importance DESC, language);

-- Composite index for category filtering
CREATE INDEX IF NOT EXISTS idx_news_category_published 
  ON news(category, published_at DESC);

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_news_source_published 
  ON news(source_id, published_at DESC);

-- Covering index for top news queries (includes all columns needed)
CREATE INDEX IF NOT EXISTS idx_news_top_covering 
  ON news(published_at DESC, importance DESC)
  WHERE importance >= 70;

-- Index for full-text search content
CREATE INDEX IF NOT EXISTS idx_news_fts_content 
  ON news(title, summary, one_line);

-- Index for entity-based queries (pSEO)
CREATE INDEX IF NOT EXISTS idx_news_entities 
  ON news(id, entities)
  WHERE json_extract(entities, '$.companies') IS NOT NULL;

-- Index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_news_tags_importance 
  ON news(published_at DESC)
  WHERE json_array_length(tags) > 0;

-- Sources composite index for crawler queries
CREATE INDEX IF NOT EXISTS idx_sources_active_crawl 
  ON sources(is_active, last_crawled_at, error_count);

-- Newsletter indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_confirmed_created 
  ON newsletter_subscribers(confirmed, subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_editions_status_scheduled 
  ON newsletter_editions(status, scheduled_for);

-- Topic pages indexes
CREATE INDEX IF NOT EXISTS idx_topic_pages_active_news 
  ON topic_pages(is_active, news_count DESC, last_news_updated_at);

-- Company pages indexes
CREATE INDEX IF NOT EXISTS idx_companies_active_news 
  ON companies(is_active, news_count DESC);

-- Comparison pages indexes
CREATE INDEX IF NOT EXISTS idx_comparison_active_views 
  ON comparison_pages(is_active, view_count DESC);

-- Email queue performance indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled_priority 
  ON email_queue(status, scheduled_for, priority);

-- Analytics indexes (if tracking tables exist)
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_date 
  ON search_analytics(query, date DESC);

-- =============================================================================
-- PARTIAL INDEXES for common filter combinations
-- =============================================================================

-- English news only (most common)
CREATE INDEX IF NOT EXISTS idx_news_english_published 
  ON news(published_at DESC, importance DESC)
  WHERE language = 'en';

-- High importance news
CREATE INDEX IF NOT EXISTS idx_news_high_importance 
  ON news(published_at DESC)
  WHERE importance >= 80;

-- Recent news (last 7 days) - needs to be refreshed
-- This is a template - actual implementation would need scheduled refresh
-- CREATE INDEX IF NOT EXISTS idx_news_recent 
--   ON news(published_at DESC)
--   WHERE published_at > unixepoch() * 1000 - 7 * 24 * 60 * 60 * 1000;

-- =============================================================================
-- INDEX USAGE ANALYSIS QUERIES
-- =============================================================================

-- Check index usage:
-- SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name;

-- Analyze query plan with EXPLAIN QUERY PLAN:
-- EXPLAIN QUERY PLAN SELECT * FROM news ORDER BY published_at DESC LIMIT 20;
