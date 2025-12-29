# Database Migration Guide

This guide covers database schema migrations for BestBlogs.dev using Cloudflare D1.

## Table of Contents

1. [Overview](#overview)
2. [Migration System](#migration-system)
3. [Creating Migrations](#creating-migrations)
4. [Running Migrations](#running-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Best Practices](#best-practices)

---

## Overview

BestBlogs.dev uses Cloudflare D1 (SQLite-based) for its database. Migrations are:

- Version controlled in `web/migrations/`
- Named with timestamp prefix: `YYYYMMDD_HHMMSS_description.sql`
- Applied automatically via CI/CD on push to main
- Tracked in the `_migrations` table

### Database Environments

| Environment | Database Name            | Purpose                |
| ----------- | ------------------------ | ---------------------- |
| Production  | `ai_news_db`             | Live production data   |
| Staging     | `ai_news_db_staging`     | Pre-production testing |
| Local       | `:memory:` or local file | Development            |

---

## Migration System

### Migration Tracking Table

```sql
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL,
  rolled_back_at INTEGER
);
```

### Migration File Structure

```
web/migrations/
  00000000_000000_init.sql
  20250129_120100_add_search_analytics.sql
  20250129_120200_add_newsletter_system.sql
  rollback/
    20250129_120100_add_search_analytics.rollback.sql
    20250129_120200_add_newsletter_system.rollback.sql
```

---

## Creating Migrations

### Step 1: Create Migration File

```bash
cd web/migrations

# Create file with timestamp
touch 20250130_140000_add_user_profiles.sql
```

### Step 2: Write Migration SQL

```sql
-- =============================================================================
-- Migration: 20250130_140000_add_user_profiles.sql
-- Description: Add user profiles table for personalization
-- Author: Your Name <your@email.com>
-- Created: 2025-01-30
-- =============================================================================

-- Create new table
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  preferences TEXT, -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Create trigger for updated_at
CREATE TRIGGER IF NOT EXISTS trg_user_profiles_updated_at
AFTER UPDATE ON user_profiles
BEGIN
  UPDATE user_profiles SET updated_at = unixepoch() * 1000 WHERE id = NEW.id;
END;

-- Seed initial data if needed
-- INSERT INTO user_profiles (id, user_id, display_name) VALUES ...
```

### Step 3: Create Rollback File

```bash
mkdir -p rollback
touch rollback/20250130_140000_add_user_profiles.rollback.sql
```

```sql
-- =============================================================================
-- Rollback: 20250130_140000_add_user_profiles.rollback.sql
-- =============================================================================

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at;
DROP INDEX IF EXISTS idx_user_profiles_user_id;
DROP TABLE IF EXISTS user_profiles;
```

### Step 4: Test Locally

```bash
# Test migration syntax
sqlite3 :memory: < migrations/20250130_140000_add_user_profiles.sql

# Test with local D1
wrangler d1 execute ai_news_db --local --file=migrations/20250130_140000_add_user_profiles.sql
```

---

## Running Migrations

### Automatic (via CI/CD)

Migrations run automatically when:

- Files in `migrations/` change
- Push to `main`, `develop`, or `staging` branch
- Manual workflow trigger

### Manual - Production

```bash
# Single migration
wrangler d1 execute ai_news_db --file=migrations/20250130_140000_add_user_profiles.sql

# Record migration
wrangler d1 execute ai_news_db --command="
  INSERT INTO _migrations (name, applied_at)
  VALUES ('20250130_140000_add_user_profiles.sql', $(date +%s)000)
"

# All pending migrations
for f in migrations/*.sql; do
  wrangler d1 execute ai_news_db --file="$f"
done
```

### Manual - Staging

```bash
# Add --local flag for local testing
wrangler d1 execute ai_news_db_staging --file=migrations/20250130_140000_add_user_profiles.sql
```

### Via GitHub Actions

```bash
# Trigger migration workflow
gh workflow run migrate.yml \
  -f environment=production \
  -f migration_file=20250130_140000_add_user_profiles.sql
```

---

## Rollback Procedures

### Automatic Rollback

```bash
# Trigger rollback via GitHub Actions
gh workflow run migrate.yml \
  -f environment=production \
  -f rollback=true
```

### Manual Rollback

```bash
# Get last migration
LAST=$(wrangler d1 execute ai_news_db --command="
  SELECT name FROM _migrations WHERE rolled_back_at IS NULL
  ORDER BY applied_at DESC LIMIT 1
" --json | jq -r '.result[0].name')

# Run rollback SQL
wrangler d1 execute ai_news_db --file="migrations/rollback/${LAST%.sql}.rollback.sql"

# Mark as rolled back
wrangler d1 execute ai_news_db --command="
  UPDATE _migrations SET rolled_back_at = $(date +%s)000 WHERE name = '$LAST'
"
```

### Rollback All to Specific Migration

```bash
# Roll back all migrations after specific one
TARGET="20250129_120100_add_search_analytics.sql"

wrangler d1 execute ai_news_db --command="
  SELECT name FROM _migrations
  WHERE rolled_back_at IS NULL
    AND applied_at > (SELECT applied_at FROM _migrations WHERE name = '$TARGET')
  ORDER BY applied_at DESC
"
```

---

## Best Practices

### DO

- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Use `CREATE INDEX IF NOT EXISTS` for indexes
- Create rollback scripts for all migrations
- Test migrations on staging first
- Document complex migrations with comments
- Use transactions for multi-step migrations
- Include `FOREIGN KEY` constraints
- Add indexes for frequently queried columns

### DON'T

- Don't drop columns without migration
- Don't change column types without data migration
- Don't use `AUTOINCREMENT` for primary keys (use TEXT IDs)
- Don't forget to update rollback scripts
- Don't merge untested migrations

### Schema Changes Guide

| Change Type   | Forward                      | Rollback                |
| ------------- | ---------------------------- | ----------------------- |
| Add table     | CREATE TABLE IF NOT EXISTS   | DROP TABLE IF EXISTS    |
| Add column    | ALTER TABLE ADD COLUMN       | ALTER TABLE DROP COLUMN |
| Rename column | ADD new, copy data, DROP old | Reverse process         |
| Add index     | CREATE INDEX IF NOT EXISTS   | DROP INDEX IF EXISTS    |
| Modify data   | UPDATE/INSERT                | Reverse UPDATE/DELETE   |

### Data Migration Pattern

For complex data changes, use a separate migration:

```sql
-- Step 1: Add new column (nullable)
ALTER TABLE news ADD COLUMN summary_html TEXT;

-- Step 2: Migrate data
UPDATE news SET summary_html = markdown_to_html(summary);

-- Step 3: Make column non-nullable in future migration
```

### Safe Migration Checklist

- [ ] Migration file follows naming convention
- [ ] SQL syntax validated locally
- [ ] Rollback script created
- [ ] Tested on staging database
- [ ] No data loss in rollback
- [ ] Foreign keys properly defined
- [ ] Indexes added for new queries
- [ ] Documentation updated

---

## Troubleshooting

### Migration Already Applied

**Error**: `UNIQUE constraint failed: _migrations.name`

**Solution**: Migration already ran. Check status:

```bash
wrangler d1 execute ai_news_db --command="SELECT * FROM _migrations"
```

### Partial Migration Failure

**Error**: Migration failed partway through

**Solution**:

1. Check what was created: `wrangler d1 execute ai_news_db --command="SELECT name FROM sqlite_master WHERE type='table'"`
2. Manually drop partial changes
3. Fix migration SQL
4. Run again

### Rollback Failure

**Error**: Rollback script fails

**Solution**:

1. Check current state
2. Manually clean up affected tables
3. Mark migration as rolled back:

```bash
wrangler d1 execute ai_news_db --command="UPDATE _migrations SET rolled_back_at = $(date +%s)000 WHERE name = '<migration_name>'"
```

---

## Related Documentation

- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Database Schema Documentation](/Volumes/SSD/dev/new/ai-news/web/src/lib/db/schema.sql)
