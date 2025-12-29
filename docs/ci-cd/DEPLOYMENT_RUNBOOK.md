# BestBlogs.dev Deployment Runbook

This document provides step-by-step instructions for deploying BestBlogs.dev to production and staging environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deployment Methods](#deployment-methods)
4. [Rollback Procedures](#rollback-procedures)
5. [Troubleshooting](#troubleshooting)
6. [Monitoring](#monitoring)

---

## Prerequisites

### Required Tools

```bash
# Node.js 20+
node --version

# npm 10+
npm --version

# Wrangler CLI
npm install -g wrangler
wrangler --version

# Git
git --version
```

### Required Access

- Cloudflare account with Workers subscription
- GitHub repository access
- Slack workspace (for notifications)

### Environment Variables

Set the following secrets in GitHub repository settings:

| Secret Name             | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Workers and D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                           |
| `SLACK_WEBHOOK_URL`     | Slack webhook for deployment notifications           |
| `CODECOV_TOKEN`         | (Optional) Codecov token for coverage reports        |

---

## Initial Setup

### 1. Cloudflare Resources Setup

```bash
# Login to Cloudflare
wrangler login

# Create D1 database (production)
wrangler d1 create ai_news_db
# Save the database ID to wrangler.json

# Create D1 database (staging)
wrangler d1 create ai_news_db_staging
# Save the database ID to wrangler.staging.json

# Create KV namespaces (production)
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "LOGS"
wrangler kv:namespace create "METRICS"
wrangler kv:namespace create "ERROR_TRACKING"
# Save IDs to wrangler.json

# Create KV namespaces (staging)
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
wrangler kv:namespace create "LOGS" --preview
wrangler kv:namespace create "METRICS" --preview
wrangler kv:namespace create "ERROR_TRACKING" --preview
# Save IDs to wrangler.staging.json

# Create R2 buckets
wrangler r2 bucket create ai-news-cache
wrangler r2 bucket create ai-news-images
wrangler r2 bucket create ai-news-cache-staging
wrangler r2 bucket create ai-news-images-staging
```

### 2. Set Wrangler Secrets

```bash
# Production secrets
wrangler secret put INGEST_SECRET
wrangler secret put CRON_SECRET
wrangler secret put ADMIN_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put DIFY_API_KEY

# Staging secrets
wrangler secret put INGEST_SECRET --env staging
wrangler secret put CRON_SECRET --env staging
wrangler secret put ADMIN_SECRET --env staging
wrangler secret put RESEND_API_KEY --env staging
wrangler secret put JWT_SECRET --env staging
wrangler secret put DIFY_API_KEY --env staging
```

### 3. Initial Database Migration

```bash
# Apply schema to production
wrangler d1 execute ai_news_db --file=./src/lib/db/schema.sql

# Apply schema to staging
wrangler d1 execute ai_news_db_staging --file=./src/lib/db/schema.sql
```

---

## Deployment Methods

### Method 1: Automatic CI/CD Deployment (Recommended)

**Trigger**: Push to `main` branch (production) or `develop`/`staging` (staging)

```bash
# Deploy to staging
git checkout develop
git merge feature-branch
git push origin develop

# Deploy to production
git checkout main
git merge develop
git push origin main
```

### Method 2: Manual GitHub Actions Trigger

1. Go to GitHub Actions tab
2. Select "CI/CD Pipeline" workflow
3. Click "Run workflow"
4. Select branch and environment
5. Click "Run workflow"

### Method 3: Local Deployment

```bash
# Build locally
cd web
npm ci
npm run build

# Deploy to production
wrangler deploy

# Deploy to staging
wrangler deploy --env staging
```

---

## Rollback Procedures

### Automatic Rollback

The CI/CD pipeline automatically performs rollback if health checks fail:

1. Previous deployment info is saved before deploying
2. Health checks run for up to 5 minutes
3. On failure, automatic rollback to previous version
4. Slack notification sent

### Manual Rollback

```bash
# List recent deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback <deployment-id>

# Or rollback to previous version
wrangler rollback

# For staging
wrangler rollback <deployment-id> --env staging
```

### Database Rollback

```bash
# Check applied migrations
wrangler d1 execute ai_news_db --command="SELECT * FROM _migrations ORDER BY applied_at DESC"

# Trigger rollback workflow
gh workflow run migrate.yml -f environment=production -f rollback=true

# Or manually run rollback SQL
wrangler d1 execute ai_news_db --file=./migrations/rollback/<migration_name>.rollback.sql
```

---

## Troubleshooting

### Build Failures

**Symptom**: CI/CD fails during build step

**Solutions**:

```bash
# Test build locally
cd web
npm ci
npm run build

# Check TypeScript errors
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test
```

### Deployment Failures

**Symptom**: `wrangler deploy` fails

**Solutions**:

```bash
# Check wrangler auth
wrangler whoami

# Validate wrangler.json
wrangler dev --dry-run

# Check account permissions
# Ensure API token has Workers and D1 permissions
```

### Health Check Failures

**Symptom**: Deployment succeeds but health checks fail

**Solutions**:

```bash
# Check worker logs
wrangler tail

# Check KV bindings
wrangler kv:key list --namespace-id=<kv-id>

# Check D1 database
wrangler d1 execute ai_news_db --command="SELECT COUNT(*) FROM news"

# Manual health check
curl https://bestblogs.dev/api/health
```

### Database Migration Issues

**Symptom**: Migration fails or database is inconsistent

**Solutions**:

```bash
# Check migration status
wrangler d1 execute ai_news_db --command="SELECT * FROM _migrations"

# Rollback specific migration
wrangler d1 execute ai_news_db --file=./migrations/rollback/<migration>.rollback.sql

# Mark migration as applied (if manually applied)
wrangler d1 execute ai_news_db --command="INSERT INTO _migrations (name, applied_at) VALUES ('<name>', $(date +%s)000)"
```

---

## Monitoring

### Health Check Endpoint

```bash
curl https://bestblogs.dev/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "0.1.0-abc1234"
}
```

### Logs and Metrics

```bash
# Real-time logs
wrangler tail

# Logs from specific KV namespace
wrangler kv:key list --namespace-id=<logs-kv-id>

# Check error tracking
wrangler kv:key get "error:<fingerprint>" --namespace-id=<error-tracking-kv-id>
```

### Performance Monitoring

Key metrics to monitor:

| Metric                | Threshold | Action                   |
| --------------------- | --------- | ------------------------ |
| Response time (p95)   | > 500ms   | Investigate slow queries |
| Error rate            | > 1%      | Check error logs         |
| Health check failures | Any       | Immediate investigation  |
| Build time            | > 20 min  | Optimize build process   |

### Alerts Setup

Configure alerts in Cloudflare dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Configure monitoring alerts for:
   - Error rate spikes
   - Response time degradation
   - Request queue buildup

---

## Blue-Green Deployment Strategy

The production deployment uses a blue-green strategy:

1. **Blue**: Current production version
2. **Green**: New version being deployed

**Process**:

1. Deploy green version alongside blue
2. Run health checks on green
3. Gradually shift traffic (5% -> 25% -> 50% -> 100%)
4. Monitor for errors at each step
5. On error: revert traffic to blue
6. On success: remove blue deployment

**Manual Traffic Control**:

```bash
# Check current routing
wrangler routes list

# Update routing (if needed)
wrangler routes add <pattern> --zone=<zone>
```

---

## Emergency Contacts

| Role             | Contact              |
| ---------------- | -------------------- |
| DevOps Lead      | devops@bestblogs.dev |
| Tech Lead        | tech@bestblogs.dev   |
| On-Call Engineer | oncall@bestblogs.dev |

---

## Related Documentation

- [CI/CD Troubleshooting Guide](./CI_CD_TROUBLESHOOTING.md)
- [Database Migration Guide](./DATABASE_MIGRATIONS.md)
- [Monitoring Setup](./MONITORING.md)
