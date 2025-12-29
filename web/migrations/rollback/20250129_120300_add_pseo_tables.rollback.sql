-- =============================================================================
-- Rollback: 20250129_120300_add_pseo_tables.rollback.sql
-- Description: Rollback pSEO tables
-- =============================================================================

-- Drop in reverse order due to foreign keys

DROP TRIGGER IF EXISTS trg_comparison_pages_updated_at;
DROP INDEX IF EXISTS idx_comparison_pages_views;
DROP INDEX IF EXISTS idx_comparison_pages_type;
DROP INDEX IF EXISTS idx_comparison_pages_slug;
DROP TABLE IF EXISTS comparison_pages;

DROP INDEX IF EXISTS idx_company_news_news;
DROP INDEX IF EXISTS idx_company_news_company;
DROP TABLE IF EXISTS company_news;

DROP INDEX IF EXISTS idx_topic_news_relevance;
DROP INDEX IF EXISTS idx_topic_news_news;
DROP INDEX IF EXISTS idx_topic_news_topic;
DROP TABLE IF EXISTS topic_news;

DROP TRIGGER IF EXISTS trg_learning_paths_updated_at;
DROP INDEX IF EXISTS idx_learning_paths_enrollment;
DROP INDEX IF EXISTS idx_learning_paths_difficulty;
DROP INDEX IF EXISTS idx_learning_paths_slug;
DROP TABLE IF EXISTS learning_paths;

DROP TRIGGER IF EXISTS trg_companies_updated_at;
DROP INDEX IF EXISTS idx_companies_industry;
DROP INDEX IF EXISTS idx_companies_news_count;
DROP INDEX IF EXISTS idx_companies_slug;
DROP TABLE IF EXISTS companies;

DROP TRIGGER IF EXISTS trg_topic_pages_updated_at;
DROP INDEX IF EXISTS idx_topic_pages_parent;
DROP INDEX IF EXISTS idx_topic_pages_news_count;
DROP INDEX IF EXISTS idx_topic_pages_slug;
DROP INDEX IF EXISTS idx_topic_pages_type;
DROP TABLE IF EXISTS topic_pages;
