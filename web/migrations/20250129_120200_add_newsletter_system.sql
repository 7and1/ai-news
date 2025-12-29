-- =============================================================================
-- Migration: 20250129_120200_add_newsletter_system.sql
-- Description: Add newsletter system tables
-- Author: CI/CD System
-- Created: 2025-01-29
-- =============================================================================

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  confirmed INTEGER DEFAULT 0,
  confirmation_token TEXT UNIQUE,
  unsubscribe_token TEXT UNIQUE,
  preferences TEXT,
  subscribed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  confirmed_at INTEGER,
  unsubscribed_at INTEGER,
  last_sent_at INTEGER,
  send_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirmed ON newsletter_subscribers(confirmed);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribed ON newsletter_subscribers(unsubscribed_at);

CREATE TRIGGER IF NOT EXISTS trg_subscribers_updated_at
AFTER UPDATE ON newsletter_subscribers
BEGIN
  UPDATE newsletter_subscribers SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- Newsletter editions
CREATE TABLE IF NOT EXISTS newsletter_editions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  article_ids TEXT,
  categories TEXT,
  language TEXT DEFAULT 'en',
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  scheduled_for INTEGER,
  sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_editions_status ON newsletter_editions(status);
CREATE INDEX IF NOT EXISTS idx_editions_sent ON newsletter_editions(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_editions_language ON newsletter_editions(language);

CREATE TRIGGER IF NOT EXISTS trg_editions_updated_at
AFTER UPDATE ON newsletter_editions
BEGIN
  UPDATE newsletter_editions SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- Newsletter send log
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at INTEGER,
  opened_at INTEGER,
  click_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (edition_id) REFERENCES newsletter_editions(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sends_edition ON newsletter_sends(edition_id);
CREATE INDEX IF NOT EXISTS idx_sends_subscriber ON newsletter_sends(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_sends_status ON newsletter_sends(status);

-- Newsletter clicks
CREATE TABLE IF NOT EXISTS newsletter_clicks (
  id TEXT PRIMARY KEY,
  send_id TEXT NOT NULL,
  url TEXT NOT NULL,
  article_id TEXT,
  clicked_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (send_id) REFERENCES newsletter_sends(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clicks_send ON newsletter_clicks(send_id);
CREATE INDEX IF NOT EXISTS idx_clicks_article ON newsletter_clicks(article_id);
CREATE INDEX IF NOT EXISTS idx_clicks_url ON newsletter_clicks(url);

-- Email queue
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  from_email TEXT DEFAULT 'noreply@bestblogs.dev',
  from_name TEXT DEFAULT 'BestBlogs.dev',
  category TEXT,
  priority INTEGER DEFAULT 5,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  scheduled_for INTEGER DEFAULT (unixepoch() * 1000),
  sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority, scheduled_for);

CREATE TRIGGER IF NOT EXISTS trg_email_queue_updated_at
AFTER UPDATE ON email_queue
BEGIN
  UPDATE email_queue SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;
