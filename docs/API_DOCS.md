# API Docs (AI News)

## Auth

- **Ingest/Admin**: use `x-ingest-secret: <INGEST_SECRET>` (or `Authorization: Bearer <INGEST_SECRET>`).
- **Revalidate**: use `x-cron-secret: <CRON_SECRET>`.

Secrets are configured via `web/wrangler.json` → `vars`.

## Public

### `GET /api/health`

Returns basic service health and total news count.

### `GET /api/news`

Query params:

- `limit` (number, max 50)
- `cursor` (string)
- `minImportance` (number)
- `language` (string)
- `category` (string)
- `sourceCategory` (string)
- `tag` (string)

Response:

- `{ items: NewsListItem[], nextCursor: string | null }`

### `GET /api/news/:id`

Returns a full `News` record (includes `content` when available).

### `GET /api/search`

Query params:

- `q` (string)
- `limit` (number)
- `cursor` (string)

Response:

- `{ items: NewsListItem[], nextCursor: string | null }`

### `GET /rss.xml`

Latest 50 items RSS feed.

## Ingest

### `POST /api/ingest`

Headers:

- `x-ingest-secret: <INGEST_SECRET>`

Body (JSON):

- `url` (string, required)
- `title` (string, required)
- `sourceId` (string, required)
- `publishedAt` (number ms, required)
- Optional: `summary`, `oneLine`, `content`, `contentFormat`, `category`, `tags`, `importance`, `sentiment`, `language`, `ogImage`, `id`
- Optional (for new sources): `sourceName`, `sourceUrl`, `sourceType`, `sourceCategory`, `sourceLanguage`

## Admin (Crawler)

### `GET /api/admin/sources`

Headers:

- `x-ingest-secret: <INGEST_SECRET>`

Returns due sources based on `crawl_frequency` + `last_crawled_at`.

### `POST /api/admin/sources`

Headers:

- `x-ingest-secret: <INGEST_SECRET>`

Body:

- `id` (string)
- `crawledAt` (number ms)
- `success` (boolean)
- `errorCountDelta` (number, optional)

## Revalidate

### `POST /api/revalidate`

Headers:

- `x-cron-secret: <CRON_SECRET>`

Body:

- `{ type: "news", id: string }` or `{ type: "batch" }`
