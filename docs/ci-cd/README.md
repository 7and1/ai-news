# CI/CD Documentation

Complete documentation for BestBlogs.dev continuous integration, deployment, and monitoring.

## Quick Links

| Document                                            | Description                        |
| --------------------------------------------------- | ---------------------------------- |
| [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)       | Step-by-step deployment procedures |
| [CI/CD Troubleshooting](./CI_CD_TROUBLESHOOTING.md) | Debug common CI/CD issues          |
| [Database Migrations](./DATABASE_MIGRATIONS.md)     | Database schema migration guide    |
| [Monitoring Guide](./MONITORING.md)                 | Logging, metrics, and alerting     |

## Quick Start

### Prerequisites

```bash
# Install tools
npm install -g wrangler
npm install -g gh

# Authenticate
wrangler login
gh auth login
```

### Create a PR

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push and create PR
git push origin feature/my-feature
gh pr create --title "Add my feature" --body "Description"
```

### Deploy to Production

```bash
# Merge PR to main
git checkout main
git merge feature/my-feature
git push origin main

# CI/CD runs automatically
# Monitor at: https://github.com/user/repo/actions
```

### Rollback

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous
wrangler rollback
```

## Pipeline Overview

```
Push/PR
  |
  v
[Lint] --> [Test] --> [Build] --> [Migrate] --> [Deploy] --> [Health Check]
  |         |          |           |            |              |
  v         v          v           v            v              v
ESLint    Vitest    Next.js     D1 SQL      Cloudflare     Monitoring
Prettier  Coverage  OpenNext    Wrangler    Workers        Alerts
```

## Quality Gates

| Check             | Threshold | Action            |
| ----------------- | --------- | ----------------- |
| ESLint warnings   | 0         | Fix or exempt     |
| TypeScript errors | 0         | Must pass         |
| Test coverage     | 70%       | Below = fail      |
| Build time        | 20 min    | Alert if exceeded |
| Health check      | 200 OK    | Rollback on fail  |

## Environments

| Environment | URL                   | Branch          | Database           |
| ----------- | --------------------- | --------------- | ------------------ |
| Production  | bestblogs.dev         | main            | ai_news_db         |
| Staging     | staging.bestblogs.dev | develop/staging | ai_news_db_staging |
| Local       | localhost:3000        | -               | :memory:           |

## Related Files

| File                            | Purpose             |
| ------------------------------- | ------------------- |
| `.github/workflows/ci.yml`      | Main CI/CD pipeline |
| `.github/workflows/migrate.yml` | Database migrations |
| `.github/workflows/crawler.yml` | Crawler deployment  |
| `web/eslint.config.mjs`         | Linting rules       |
| `web/vitest.config.ts`          | Test configuration  |
| `web/migrations/`               | Database migrations |

## Support

- Slack: #devops
- Email: devops@bestblogs.dev
- Issues: https://github.com/user/repo/issues
