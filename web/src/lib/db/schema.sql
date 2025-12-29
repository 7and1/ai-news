PRAGMA foreign_keys = ON;

-- Subscription sources
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- blog/twitter/newsletter/wechat/news
  category TEXT,      -- ai_company/ai_media/ai_kol/ai_tool
  language TEXT,      -- en/zh
  crawl_frequency INTEGER DEFAULT 3600, -- seconds
  need_crawl INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  last_crawled_at INTEGER,
  last_success_at INTEGER,
  error_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TRIGGER IF NOT EXISTS trg_sources_updated_at
AFTER UPDATE ON sources
BEGIN
  UPDATE sources SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- News items
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  one_line TEXT,
  content TEXT, -- sanitized HTML
  url TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,
  category TEXT,
  tags TEXT, -- JSON array
  importance INTEGER DEFAULT 50, -- 0..100
  sentiment TEXT, -- positive/neutral/negative
  language TEXT DEFAULT 'en', -- en/zh
  og_image TEXT,
  published_at INTEGER NOT NULL,
  crawled_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  -- pSEO: Extracted entities for linking and vertical pages
  entities TEXT, -- JSON object: {companies: [], models: [], technologies: [], concepts: []}
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_importance ON news(importance DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source_id);
CREATE INDEX IF NOT EXISTS idx_news_language ON news(language);

CREATE TRIGGER IF NOT EXISTS trg_news_updated_at
AFTER UPDATE ON news
BEGIN
  UPDATE news SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- Event clusters (simple aggregation)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  news_ids TEXT,  -- JSON array of news ids
  companies TEXT, -- JSON array
  models TEXT,    -- JSON array
  importance INTEGER DEFAULT 50,
  started_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_updated ON events(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_importance ON events(importance DESC);

CREATE TRIGGER IF NOT EXISTS trg_events_updated_at
AFTER UPDATE ON events
BEGIN
  UPDATE events SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- Tweets (optional)
CREATE TABLE IF NOT EXISTS tweets (
  id TEXT PRIMARY KEY,
  news_id TEXT,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  posted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (news_id) REFERENCES news(id)
);

-- Daily stats
CREATE TABLE IF NOT EXISTS stats (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  news_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  crawl_success INTEGER DEFAULT 0,
  crawl_error INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS news_fts
USING fts5(
  id UNINDEXED,
  title,
  summary,
  content,
  tags,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS trg_news_fts_insert
AFTER INSERT ON news
BEGIN
  INSERT INTO news_fts (id, title, summary, content, tags)
  VALUES (NEW.id, NEW.title, COALESCE(NEW.summary, ''), COALESCE(NEW.content, ''), COALESCE(NEW.tags, '[]'));
END;

CREATE TRIGGER IF NOT EXISTS trg_news_fts_delete
AFTER DELETE ON news
BEGIN
  DELETE FROM news_fts WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_news_fts_update
AFTER UPDATE ON news
BEGIN
  UPDATE news_fts
    SET title = NEW.title,
        summary = COALESCE(NEW.summary, ''),
        content = COALESCE(NEW.content, ''),
        tags = COALESCE(NEW.tags, '[]')
  WHERE id = NEW.id;
END;

-- =============================================================================
-- pSEO: Topic pages table
-- =============================================================================
CREATE TABLE IF NOT EXISTS topic_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- model, technology, concept, company
  parent_topic_id TEXT, -- For hierarchical topics
  aliases TEXT, -- JSON array of alternative names/variants
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT, -- Rich content about the topic
  news_count INTEGER DEFAULT 0,
  last_news_updated_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (parent_topic_id) REFERENCES topic_pages(id)
);

CREATE INDEX IF NOT EXISTS idx_topic_pages_type ON topic_pages(type);
CREATE INDEX IF NOT EXISTS idx_topic_pages_slug ON topic_pages(slug);
CREATE INDEX IF NOT EXISTS idx_topic_pages_news_count ON topic_pages(news_count DESC);
CREATE INDEX IF NOT EXISTS idx_topic_pages_parent ON topic_pages(parent_topic_id);

CREATE TRIGGER IF NOT EXISTS trg_topic_pages_updated_at
AFTER UPDATE ON topic_pages
BEGIN
  UPDATE topic_pages SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- =============================================================================
-- pSEO: Company profiles table
-- =============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  description TEXT,
  founded_year INTEGER,
  headquarters TEXT,
  website TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  logo_url TEXT,
  industry TEXT,
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT, -- Company profile content
  news_count INTEGER DEFAULT 0,
  last_news_updated_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_news_count ON companies(news_count DESC);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);

CREATE TRIGGER IF NOT EXISTS trg_companies_updated_at
AFTER UPDATE ON companies
BEGIN
  UPDATE companies SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- =============================================================================
-- pSEO: Learning paths table
-- =============================================================================
CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT, -- beginner, intermediate, advanced
  estimated_hours INTEGER,
  topics TEXT, -- JSON array of topic IDs
  prerequisites TEXT, -- JSON array of path IDs or topic IDs
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT,
  enrollment_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_slug ON learning_paths(slug);
CREATE INDEX IF NOT EXISTS idx_learning_paths_difficulty ON learning_paths(difficulty);
CREATE INDEX IF NOT EXISTS idx_learning_paths_enrollment ON learning_paths(enrollment_count DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_paths_updated_at
AFTER UPDATE ON learning_paths
BEGIN
  UPDATE learning_paths SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- =============================================================================
-- pSEO: Topic news mapping (many-to-many relationship)
-- =============================================================================
CREATE TABLE IF NOT EXISTS topic_news (
  topic_id TEXT NOT NULL,
  news_id TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50, -- 0-100, how relevant the news is to the topic
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (topic_id, news_id),
  FOREIGN KEY (topic_id) REFERENCES topic_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_news_topic ON topic_news(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_news_news ON topic_news(news_id);
CREATE INDEX IF NOT EXISTS idx_topic_news_relevance ON topic_news(relevance_score DESC);

-- =============================================================================
-- pSEO: Company news mapping
-- =============================================================================
CREATE TABLE IF NOT EXISTS company_news (
  company_id TEXT NOT NULL,
  news_id TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (company_id, news_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_news_company ON company_news(company_id);
CREATE INDEX IF NOT EXISTS idx_company_news_news ON company_news(news_id);

-- =============================================================================
-- pSEO: Comparison pages
-- =============================================================================
CREATE TABLE IF NOT EXISTS comparison_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  comparison_type TEXT, -- model-vs-model, tool-vs-tool, etc
  entity_a_type TEXT, -- topic, company, etc
  entity_a_id TEXT,
  entity_b_type TEXT,
  entity_b_id TEXT,
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT, -- Comparison content
  view_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_comparison_pages_slug ON comparison_pages(slug);
CREATE INDEX IF NOT EXISTS idx_comparison_pages_type ON comparison_pages(comparison_type);
CREATE INDEX IF NOT EXISTS idx_comparison_pages_views ON comparison_pages(view_count DESC);

CREATE TRIGGER IF NOT EXISTS trg_comparison_pages_updated_at
AFTER UPDATE ON comparison_pages
BEGIN
  UPDATE comparison_pages SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- =============================================================================
-- NEWSLETTER SYSTEM
-- =============================================================================

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  confirmed INTEGER DEFAULT 0,
  confirmation_token TEXT UNIQUE,
  unsubscribe_token TEXT UNIQUE,
  preferences TEXT, -- JSON: {"categories": ["Artificial_Intelligence", ...], "frequency": "weekly", "language": "en"}
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

-- Newsletter editions (sent newsletters)
CREATE TABLE IF NOT EXISTS newsletter_editions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  article_ids TEXT, -- JSON array of news IDs
  categories TEXT, -- JSON array of categories included
  language TEXT DEFAULT 'en',
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, failed
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

-- Newsletter send log (tracking individual sends)
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, bounced
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

-- Newsletter clicks (link tracking)
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

-- Email queue for bulk sending
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  from_email TEXT DEFAULT 'noreply@bestblogs.dev',
  from_name TEXT DEFAULT 'BestBlogs.dev',
  category TEXT, -- for categorizing emails (confirmation, newsletter, etc)
  priority INTEGER DEFAULT 5, -- 1=high, 5=normal, 10=low
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
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

