-- =============================================================================
-- Rollback: 20250129_120100_add_search_analytics.rollback.sql
-- Description: Rollback search analytics tables
-- =============================================================================

DROP INDEX IF EXISTS idx_search_suggestions_prefix;
DROP TABLE IF EXISTS search_suggestions;

DROP INDEX IF EXISTS idx_popular_searches_last_searched;
DROP INDEX IF EXISTS idx_popular_searches_count;
DROP TABLE IF EXISTS popular_searches;

DROP INDEX IF EXISTS idx_search_queries_created;
DROP INDEX IF EXISTS idx_search_queries_query;
DROP TABLE IF EXISTS search_queries;
