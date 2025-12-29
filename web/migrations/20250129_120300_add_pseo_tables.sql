-- =============================================================================
-- Migration: 20250129_120300_add_pseo_tables.sql
-- Description: Add pSEO (programmatic SEO) tables for topic pages
-- Author: CI/CD System
-- Created: 2025-01-29
-- =============================================================================

-- Topic pages
CREATE TABLE IF NOT EXISTS topic_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  parent_topic_id TEXT,
  aliases TEXT,
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT,
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

-- Companies
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
  content_html TEXT,
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

-- Learning paths
CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT,
  estimated_hours INTEGER,
  topics TEXT,
  prerequisites TEXT,
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

-- Topic news mapping
CREATE TABLE IF NOT EXISTS topic_news (
  topic_id TEXT NOT NULL,
  news_id TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (topic_id, news_id),
  FOREIGN KEY (topic_id) REFERENCES topic_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_news_topic ON topic_news(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_news_news ON topic_news(news_id);
CREATE INDEX IF NOT EXISTS idx_topic_news_relevance ON topic_news(relevance_score DESC);

-- Company news mapping
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

-- Comparison pages
CREATE TABLE IF NOT EXISTS comparison_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  comparison_type TEXT,
  entity_a_type TEXT,
  entity_a_id TEXT,
  entity_b_type TEXT,
  entity_b_id TEXT,
  meta_title TEXT,
  meta_description TEXT,
  content_html TEXT,
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
