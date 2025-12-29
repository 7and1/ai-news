-- =============================================================================
-- Rollback: 20250129_120200_add_newsletter_system.rollback.sql
-- Description: Rollback newsletter system tables
-- =============================================================================

-- Drop in reverse order due to foreign keys

DROP TRIGGER IF EXISTS trg_email_queue_updated_at;
DROP INDEX IF EXISTS idx_email_queue_priority;
DROP INDEX IF EXISTS idx_email_queue_scheduled;
DROP INDEX IF EXISTS idx_email_queue_status;
DROP TABLE IF EXISTS email_queue;

DROP INDEX IF EXISTS idx_clicks_url;
DROP INDEX IF EXISTS idx_clicks_article;
DROP INDEX IF EXISTS idx_clicks_send;
DROP TABLE IF EXISTS newsletter_clicks;

DROP INDEX IF EXISTS idx_sends_status;
DROP INDEX IF EXISTS idx_sends_subscriber;
DROP INDEX IF EXISTS idx_sends_edition;
DROP TABLE IF EXISTS newsletter_sends;

DROP TRIGGER IF EXISTS trg_editions_updated_at;
DROP INDEX IF EXISTS idx_editions_language;
DROP INDEX IF EXISTS idx_editions_sent;
DROP INDEX IF EXISTS idx_editions_status;
DROP TABLE IF EXISTS newsletter_editions;

DROP TRIGGER IF EXISTS trg_subscribers_updated_at;
DROP INDEX IF EXISTS idx_subscribers_unsubscribed;
DROP INDEX IF EXISTS idx_subscribers_confirmed;
DROP INDEX IF EXISTS idx_subscribers_email;
DROP TABLE IF EXISTS newsletter_subscribers;
