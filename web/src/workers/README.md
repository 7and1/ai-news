# Cloudflare Workers Crawler

A production-ready RSS crawler for BestBlogs.dev running on Cloudflare Workers with cron triggers, queue-based processing, and AI-powered content analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Workers                          │
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│  │   Cron       │      │   Crawler    │      │   Queue      │     │
│  │   Triggers   │─────▶│   Worker     │─────▶│   Producer   │     │
│  │              │      │              │      │              │     │
│  │  Hourly      │      │  - Fetch RSS │      │  - Enqueue   │     │
│  │  3-Hourly    │      │  - Parse     │      │    items     │     │
│  │  6-Hourly    │      │  - Analyze   │      │              │     │
│  └──────────────┘      └──────────────┘      └──────┬───────┘     │
│                                                      │             │
│                                                      ▼             │
│                                              ┌──────────────┐     │
│                                              │   Crawl      │     │
│                                              │   Queue      │     │
│                                              └──────┬───────┘     │
│                                                     │             │
│                                                     ▼             │
│                                              ┌──────────────┐     │
│                                              │   Consumer   │     │
│                                              │   Worker     │     │
│                                              │              │     │
│                                              │  - Full-text │     │
│                                              │  - AI Analyze│     │
│                                              │  - Ingest    │     │
│                                              └──────┬───────┘     │
│                                                     │             │
│                              On failure             ▼             │
│                              ┌─────────────────────────────┐   │
│                              │      Dead Letter Queue      │   │
│                              └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

### Scheduled Crawling

- **High Priority** (hourly): Articles, blogs, news
- **Medium Priority** (every 3 hours): Podcasts, videos
- **Low Priority** (every 6 hours): Twitter, newsletters, WeChat

### Queue-Based Processing

- Decouples fetching from processing
- Automatic retries with exponential backoff
- Dead letter queue for failed items
- Configurable concurrency

### AI-Powered Analysis

- Anthropic Claude integration
- Google Gemini fallback
- Heuristic analysis as final fallback
- Language detection (English/Chinese)
- Category classification
- Tag extraction
- Importance scoring (0-100)

### Full-Text Extraction

- Jina Reader API for clean content
- Fallback extraction on failure
- Configurable timeout
- Retry logic for transient errors

### Content Deduplication

- URL normalization
- Title similarity detection
- Near-duplicate fingerprinting
- Database deduplication checks

## Environment Variables

| Variable                    | Description               | Default                   |
| --------------------------- | ------------------------- | ------------------------- |
| `INGEST_SECRET`             | Secret for ingest API     | Required                  |
| `CRON_SECRET`               | Secret for manual trigger | Optional                  |
| `INGEST_API_URL`            | Ingest API endpoint       | Auto-detected             |
| `ANTHROPIC_API_KEY`         | Anthropic API key         | Optional                  |
| `ANTHROPIC_MODEL`           | Anthropic model           | claude-3-5-haiku-20241022 |
| `GEMINI_API_KEY`            | Google API key            | Optional                  |
| `GEMINI_MODEL`              | Google model              | gemini-1.5-flash-001      |
| `JINA_READER_PREFIX`        | Jina Reader URL prefix    | https://r.jina.ai/http:// |
| `JINA_TIMEOUT`              | Jina timeout (ms)         | 30000                     |
| `CRAWLER_SOURCES_PER_BATCH` | Sources per batch         | 50                        |
| `CRAWLER_ITEMS_PER_SOURCE`  | Items per source          | 20                        |
| `CRAWLER_CONCURRENCY`       | Concurrent requests       | 5                         |
| `CRAWLER_MAX_RETRIES`       | Max retry attempts        | 3                         |

## API Endpoints

### Crawler Worker

- `GET /health` - Health check
- `GET /status` - Crawler status
- `GET /metrics` - Crawler metrics
- `POST /crawl` - Manual crawl trigger (requires auth)

### Queue Producer

- `GET /health` - Health check
- `GET /stats` - Queue statistics
- `POST /enqueue` - Enqueue items from a source
- `POST /enqueue-due` - Enqueue from due sources
- `POST /enqueue-batch` - Batch enqueue
- `POST /submit` - Submit single article

### Queue Consumer

- `GET /health` - Health check
- `GET /stats` - Consumer statistics

## Wrangler Configuration

The crawler uses the following Cloudflare resources:

- **D1 Database**: `ai_news_db` for sources and articles
- **KV Namespaces**: `LOGS`, `METRICS`, `ERROR_TRACKING` for monitoring
- **Queue**: `ai-news-crawl-queue` for item processing
- **Dead Letter Queue**: `ai-news-dlq` for failed items
- **Cron Triggers**: Three schedules for different priorities

## Deployment

1. Set required environment variables:

```bash
wrangler secret put INGEST_SECRET
wrangler secret put ANTHROPIC_API_KEY  # Optional
wrangler secret put GEMINI_API_KEY     # Optional
```

2. Create the queue:

```bash
wrangler queues create ai-news-crawl-queue
wrangler queues create ai-news-dlq
```

3. Deploy:

```bash
npm run build:worker
wrangler deploy
```

## Monitoring

The crawler exposes metrics at `/metrics`:

- `crawler_runs_total` - Total crawler runs
- `crawler_duration_ms` - Crawler duration histogram
- `crawler_sources_processed` - Sources processed
- `crawler_articles_processed` - Articles ingested
- `crawler_articles_failed` - Articles failed
- `queue_batches_total` - Queue batches processed
- `queue_messages_processed` - Queue messages processed
- `queue_messages_succeeded` - Successful messages
- `queue_messages_failed` - Failed messages
- `queue_dlq_messages` - Dead letter queue messages

## Error Handling

The crawler implements comprehensive error handling:

1. **Source Level**: Errors update source error count
2. **Item Level**: Failed items are retried with backoff
3. **Queue Level**: Max retries trigger DLQ
4. **Cron Level**: Errors are logged and reported

## Development

Run locally:

```bash
npm run dev
```

Test crawler:

```bash
curl -X POST "http://localhost:8787/crawl" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"priority": "high"}'
```

## Source Types

| Type         | Priority | Description       |
| ------------ | -------- | ----------------- |
| `article`    | High     | Blog articles     |
| `blog`       | High     | Personal blogs    |
| `news`       | High     | News sites        |
| `podcast`    | Medium   | Podcast RSS feeds |
| `video`      | Medium   | Video channels    |
| `twitter`    | Low      | Twitter/X feeds   |
| `newsletter` | Low      | Email newsletters |
| `wechat`     | Low      | WeChat accounts   |

## License

MIT
