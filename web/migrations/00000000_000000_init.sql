-- =============================================================================
-- Migration: 00000000_000000_init.sql
-- Description: Initial database schema setup
-- Author: CI/CD System
-- Created: 2024-01-01
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Migration tracking table (idempotent)
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL,
  rolled_back_at INTEGER
);

-- Apply main schema
-- Note: The main schema is applied via schema.sql file
-- This migration file serves as a marker and can include any additional setup

-- Seed initial migration record (this migration itself)
INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES ('00000000_000000_init.sql', unixepoch() * 1000);
