import { z } from "zod";
import type { CrawlerConfig } from "./config.js";
import type { IngestPayload, Source } from "./types.js";

const sourcesResponseSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      type: z.string(),
      category: z.string().nullable(),
      language: z.string().nullable(),
      crawlFrequency: z.number(),
      needCrawl: z.boolean(),
      lastCrawledAt: z.number().nullable().optional(),
      errorCount: z.number().optional(),
    }),
  ),
});

// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Fetch with timeout support
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Retry with exponential backoff
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[api] retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function fetchDueSources(
  config: CrawlerConfig,
): Promise<Source[]> {
  return fetchWithRetry(async () => {
    const url = new URL("/api/admin/sources", config.AI_NEWS_BASE_URL);
    url.searchParams.set("limit", String(config.SOURCES_LIMIT));

    const res = await fetchWithTimeout(url, {
      headers: {
        "x-ingest-secret": config.INGEST_SECRET,
        "user-agent": "ai-news-crawler/0.1",
      },
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch sources: ${res.status} ${errorText}`);
    }
    const json = await res.json();
    const parsed = sourcesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Invalid sources response: ${parsed.error.message}`);
    }
    return parsed.data.sources;
  });
}

export async function postIngest(
  config: CrawlerConfig,
  payload: IngestPayload,
): Promise<void> {
  return fetchWithRetry(async () => {
    const url = new URL("/api/ingest", config.AI_NEWS_BASE_URL);
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ingest-secret": config.INGEST_SECRET,
        "user-agent": "ai-news-crawler/0.1",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ingest failed: ${res.status} ${errorText}`);
    }
    // Don't need to return the response body
  });
}

export async function postSourceStatus(
  config: CrawlerConfig,
  input: {
    id: string;
    crawledAt: number;
    success: boolean;
    errorCountDelta?: number;
  },
): Promise<void> {
  return fetchWithRetry(async () => {
    const url = new URL("/api/admin/sources", config.AI_NEWS_BASE_URL);
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ingest-secret": config.INGEST_SECRET,
        "user-agent": "ai-news-crawler/0.1",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to update source status: ${res.status} ${errorText}`,
      );
    }
  }).catch((err) => {
    // Log but don't throw - status updates are non-critical
    console.warn(`[api] failed to post source status for ${input.id}:`, err);
  });
}
