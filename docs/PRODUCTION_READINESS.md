# Production Readiness Checklist (AI News)

This document is the “ship it” checklist for turning this repo into a reliable, SEO-friendly, production system (frontend + backend + content pipeline).

## 1) Critical User Flows (MVP)

- Home (`/`) loads fast and shows fresh items.
- Latest (`/latest`) supports filters and pagination.
- Search (`/search`) returns relevant results + suggestions.
- News detail (`/news/[id]`) renders safely (no HTML injection), links entities, and has OG/meta.
- Newsletter:
  - Subscribe (`/newsletter` → `/api/newsletter/subscribe`)
  - Confirm (`/api/newsletter/confirm/[token]`)
  - Unsubscribe (`/api/newsletter/unsubscribe`)
- Admin:
  - Sources CRUD (`/api/admin/sources`)
  - Newsletter dashboard (`/admin/newsletter`)
  - Monitoring endpoints (`/api/admin/metrics`, `/api/admin/errors`, `/api/admin/dashboard`)

## 2) Background Jobs (Content + Email)

### Crawler

Goal: continuously ingest fresh items into `news` with dedupe and entity linking.

- Cloudflare Scheduled events enabled via `triggers.crons`.
- Runtime handler implemented in `web/worker.ts` (OpenNext wrapper).
- Crawl execution endpoint: `POST /api/cron/crawl` (auth: `CRON_SECRET`).
- Safe defaults:
  - `CRAWLER_ENABLED=false` in `web/wrangler.json` (no surprise crawling on the main web worker).
  - Enable crawling in a dedicated “crawler worker” config or env.

### Email queue processor

Goal: reliably deliver queued emails (e.g., confirmations, newsletters) via Resend.

- Execution endpoint: `POST /api/cron/email/process` (auth: `CRON_SECRET`).
- Recommended to run on a separate cron schedule and/or separate worker:
  - Set `EMAIL_WORKER_ENABLED=true` + add an email cron trigger.
  - Ensure `RESEND_API_KEY` is configured.

## 3) Security & Abuse Prevention

- Secrets are never committed; use `wrangler secret put …`.
- Ingest endpoint requires `INGEST_SECRET`.
- Cron endpoints require `CRON_SECRET`.
- Admin endpoints require `CRON_SECRET` and/or JWT depending on route.
- Rate limiting enabled and tuned for:
  - Public pages
  - Search
  - Ingest/cron
  - Admin
- CORS is strict in staging/prod (`ALLOWED_ORIGINS`).

## 4) SEO / pSEO Requirements

- Canonicals correct (especially `metadataBase` and per-page `alternates.canonical`).
- Sitemap includes:
  - `/news/[id]` (high-importance)
  - `/topic/[slug]`, `/company/[slug]`, `/learn/[topic]`, `/compare/[slug]`, role pages, plus `/rss.xml`
- Robots:
  - Disallow `/api/*`
  - Allow all public routes
- Structured data:
  - `WebSite` JSON-LD on `/`
  - `NewsArticle` JSON-LD on `/news/[id]`
  - `BreadcrumbList` JSON-LD on pSEO and news pages
- Internal linking:
  - News content entity links (`/company/*`, `/topic/*`)
  - Related entities/topics modules on topic/company pages

## 5) Observability & Ops

- Health endpoint: `/api/health`
- Metrics endpoint(s): `/api/admin/metrics` (auth protected)
- Error tracking:
  - Store key errors in `ERROR_TRACKING` KV
  - Track crawler runs in `METRICS` KV (`crawler:last_run`, `crawler:recent_runs`)
- Runbook exists (see `docs/ci-cd/DEPLOYMENT_RUNBOOK.md`)

## 6) Release Gate (What “done” means)

- `cd web && npm run lint`
- `cd web && npm run typecheck`
- `cd web && npm test`
- `cd web && npm run build`
- Deploy smoke checks:
  - `GET /api/health` returns 200
  - Home + a news detail page load
  - `POST /api/cron/crawl` works with `CRON_SECRET` (in crawler worker)
  - `POST /api/cron/email/process` works with `CRON_SECRET` (if email worker enabled)
