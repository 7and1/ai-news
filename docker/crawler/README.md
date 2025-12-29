# AI News Crawler

TypeScript RSS crawler that pulls due sources from the web worker and pushes analyzed items to `/api/ingest`.

## Setup

```bash
cd docker/crawler
npm install
cp .env.example .env
```

Required env vars:

- `AI_NEWS_BASE_URL` (e.g. `http://localhost:3000`)
- `INGEST_SECRET` (must match `web/wrangler.json` → `vars.INGEST_SECRET`)

Optional AI analysis:

- `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`

## Run

```bash
npm run build
npm run start
```

For a continuous loop, set `LOOP=true` (and optionally `LOOP_INTERVAL_MS`).
