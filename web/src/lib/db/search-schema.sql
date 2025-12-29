-- Search Analytics and Enhancement Schema
-- This file extends the base schema with search-specific features

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

-- Popular searches aggregate (updated periodically)
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
  type TEXT NOT NULL, -- 'query', 'title', 'tag', 'entity'
  score INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_search_suggestions_prefix ON search_suggestions(prefix, score DESC);

-- Enhanced FTS table with ranking support
-- Drop existing FTS table and recreate with better configuration
-- DROP TABLE IF EXISTS news_fts;

-- Enhanced FTS5 table with custom ranking columns
CREATE VIRTUAL TABLE IF NOT EXISTS news_fts_enhanced
USING fts5(
  id UNINDEXED,
  title,
  summary,
  content,
  tags,
  category,
  source_name,
  importance UNINDEXED,
  published_at UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 1',
  content = 'news_content'
);

-- External content table for better FTS5 ranking
CREATE TABLE IF NOT EXISTS news_content(
  id TEXT PRIMARY KEY,
  title TEXT,
  summary TEXT,
  content TEXT,
  tags TEXT,
  category TEXT,
  source_name TEXT
);

-- Insert triggers for enhanced FTS
CREATE TRIGGER IF NOT EXISTS trg_news_fts_enhanced_insert
AFTER INSERT ON news
BEGIN
  INSERT INTO news_content (id, title, summary, content, tags, category, source_name)
  VALUES (NEW.id, NEW.title, COALESCE(NEW.summary, ''), COALESCE(NEW.content, ''),
          COALESCE(NEW.tags, '[]'), COALESCE(NEW.category, ''),
          (SELECT name FROM sources WHERE id = NEW.source_id));

  INSERT INTO news_fts_enhanced (id, title, summary, content, tags, category, source_name, importance, published_at)
  VALUES (NEW.id, NEW.title, COALESCE(NEW.summary, ''), COALESCE(NEW.content, ''),
          COALESCE(NEW.tags, '[]'), COALESCE(NEW.category, ''),
          (SELECT name FROM sources WHERE id = NEW.source_id),
          NEW.importance, NEW.published_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_news_fts_enhanced_delete
AFTER DELETE ON news
BEGIN
  DELETE FROM news_fts_enhanced WHERE id = OLD.id;
  DELETE FROM news_content WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_news_fts_enhanced_update
AFTER UPDATE ON news
BEGIN
  UPDATE news_content
    SET title = NEW.title,
        summary = COALESCE(NEW.summary, ''),
        content = COALESCE(NEW.content, ''),
        tags = COALESCE(NEW.tags, '[]'),
        category = COALESCE(NEW.category, ''),
        source_name = (SELECT name FROM sources WHERE id = NEW.source_id)
  WHERE id = NEW.id;

  UPDATE news_fts_enhanced
    SET title = NEW.title,
        summary = COALESCE(NEW.summary, ''),
        content = COALESCE(NEW.content, ''),
        tags = COALESCE(NEW.tags, '[]'),
        category = COALESCE(NEW.category, ''),
        source_name = (SELECT name FROM sources WHERE id = NEW.source_id),
        importance = NEW.importance,
        published_at = NEW.published_at
  WHERE id = NEW.id;
END;

-- User search history (client-side stored, optional server-side)
CREATE TABLE IF NOT EXISTS user_search_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  filters TEXT, -- JSON object of applied filters
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_user_search_history_session ON user_search_history(session_id, created_at DESC);
