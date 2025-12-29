import Parser from "rss-parser";
import pLimit from "p-limit";
import type { CrawlerConfig } from "./config.js";
import type { IngestPayload, Source } from "./types.js";
import { analyze } from "./analyze.js";
import { fetchFullContent } from "./jina.js";
import { postIngest } from "./api.js";

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  ["content:encoded"]?: string;
};

const parser = new Parser<RssItem>({
  customFields: {
    item: ["content:encoded"],
  },
  timeout: 30000, // 30 second timeout for RSS fetches
  requestHeaders: {
    "User-Agent": "ai-news-crawler/0.1",
  },
});

function toMsDate(input: string | undefined): number | null {
  if (!input) return null;
  const d = new Date(input);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function pickUrl(item: RssItem): string | null {
  const url = item.link || item.guid;
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

function pickContent(item: RssItem): string {
  return (
    item["content:encoded"] ||
    item.content ||
    item.contentSnippet ||
    ""
  ).trim();
}

function guessFormat(content: string): "html" | "markdown" | "text" {
  if (/<[a-z][\s\S]*>/i.test(content)) return "html";
  if (content.includes("\n")) return "markdown";
  return "text";
}

// Retry with exponential backoff for RSS parsing
async function parseWithRetry(
  url: string,
  maxRetries = 3,
): Promise<Parser.Output<RssItem>> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `[crawl] RSS parse retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function crawlSource(config: CrawlerConfig, source: Source) {
  let feed: Parser.Output<RssItem>;
  try {
    feed = await parseWithRetry(source.url);
  } catch (err) {
    console.error(
      `[crawl] Failed to parse RSS feed for ${source.name} (${source.url}):`,
      err,
    );
    throw err;
  }

  const items = (feed.items ?? []).slice(0, config.ITEMS_PER_SOURCE);

  // Separate rate limiter for AI API calls to avoid hitting rate limits
  const aiLimiter = pLimit(5); // Max 5 concurrent AI requests

  const limiter = pLimit(config.CONCURRENCY);
  const tasks = items.map((item) =>
    limiter(async () => {
      const url = pickUrl(item);
      const title = (item.title ?? "").trim();
      if (!url || !title) return { ok: false as const, skipped: true as const };

      const publishedAt =
        toMsDate(item.isoDate) ?? toMsDate(item.pubDate) ?? Date.now();

      let content = pickContent(item);
      let contentFormat: IngestPayload["contentFormat"] = guessFormat(content);

      // Fetch full content with fallback to RSS content
      if (source.needCrawl) {
        try {
          content = await fetchFullContent(config, url);
          contentFormat = "markdown";
        } catch (err) {
          console.warn(
            `[crawl] full content fetch failed for ${url}, using RSS content:`,
            err,
          );
          // content already has the RSS content, format stays as guessed
        }
      }

      // Run analysis through AI rate limiter
      const analysis = await aiLimiter(() =>
        analyze(config, {
          title,
          content,
          sourceName: source.name,
          sourceCategory: source.category,
        }),
      );

      const payload: IngestPayload = {
        url,
        title,
        sourceId: source.id,
        publishedAt,
        crawledAt: Date.now(),
        summary: analysis.summary,
        oneLine: analysis.oneLine,
        content,
        contentFormat,
        category: analysis.category,
        tags: analysis.tags,
        importance: analysis.importance,
        sentiment: analysis.sentiment,
        language: analysis.language,
      };

      await postIngest(config, payload);
      return { ok: true as const, skipped: false as const };
    }),
  );

  const results = await Promise.allSettled(tasks);
  const ok = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok,
  ).length;
  const skipped = results.filter(
    (r) => r.status === "fulfilled" && r.value.skipped,
  ).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { ok, skipped, failed, total: items.length };
}
