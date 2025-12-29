# AI News

基于 `docs/IMPLEMENTATION_PLAN.md` 的生产级 AI 行业快讯聚合站：Cloudflare Workers + D1（边缘 SQLite）+ OpenNext + Next.js（App Router）。

## Features

- SEO: `sitemap.xml` / `robots.txt` / JSON-LD / OG Image
- D1 schema + seeds: `web/src/lib/db/schema.sql`, `web/src/lib/db/seed.sql`
- Public APIs: `/api/news`, `/api/search`, `/api/news/:id`, `/rss.xml`
- Ingest pipeline: `/api/ingest`（带密钥）
- Crawler: `docker/crawler`（RSS -> 可选 Jina 全文 -> 可选 Claude/Gemini -> ingest）
- CI/CD: Automated testing, building, and deployment

## Quick Start (Local)

### 1) Web (Next.js + OpenNext + Wrangler)

```bash
cd web
npm install

# 初始化本地 D1（wrangler local）
npm run d1:migrate:local
npm run d1:seed:local

# 预览 Workers 运行形态（推荐）
npm run preview
```

访问：

- `http://localhost:3000`
- `http://localhost:3000/rss.xml`
- `http://localhost:3000/api/health`

### 2) Crawler

```bash
cd docker/crawler
npm install
cp .env.example .env

# 填写 AI_NEWS_BASE_URL / INGEST_SECRET（需与 web/wrangler.json vars 匹配）
npm run build
node dist/index.js
```

## Config

- `web/wrangler.json`: `vars.SITE_URL`, `vars.INGEST_SECRET`, `vars.CRON_SECRET`
- `docker/crawler/.env`: `AI_NEWS_BASE_URL`, `INGEST_SECRET`, 可选 `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`

## CI/CD

The project includes a complete CI/CD pipeline:

- **GitHub Actions**: Automated testing, building, and deployment
- **Pre-commit Hooks**: Linting and formatting with Husky
- **Database Migrations**: Version-controlled schema changes with rollback support
- **Monitoring**: Health checks, logging, and error tracking

See [docs/ci-cd/README.md](./docs/ci-cd/README.md) for full documentation.

### Developer Setup

```bash
# Run the CI/CD setup script
./scripts/setup-ci-cd.sh

# Or manually:
cd web
npm install
npx husky install
```

### Available Commands

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `npm run lint`          | Run ESLint                   |
| `npm run lint:fix`      | Fix ESLint issues            |
| `npm run format`        | Format code with Prettier    |
| `npm run typecheck`     | Check TypeScript types       |
| `npm run test`          | Run tests                    |
| `npm run test:coverage` | Run tests with coverage      |
| `npm run build`         | Build for production         |
| `npm run deploy`        | Deploy to Cloudflare Workers |

### Deployment

**Automatic**: Push to `main` branch triggers production deployment

**Manual**:

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

## Documentation

- [CI/CD Documentation](./docs/ci-cd/)
- [Deployment Runbook](./docs/ci-cd/DEPLOYMENT_RUNBOOK.md)
- [Troubleshooting Guide](./docs/ci-cd/CI_CD_TROUBLESHOOTING.md)
- [Database Migrations](./docs/ci-cd/DATABASE_MIGRATIONS.md)
- [Monitoring Setup](./docs/ci-cd/MONITORING.md)
