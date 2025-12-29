import type { CrawlerConfig } from "./config.js";

// Validate URL before fetching
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Maximum content size to fetch (1MB)
const MAX_CONTENT_SIZE = 1_000_000;

// Default timeout for Jina fetch (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

export async function fetchFullContent(config: CrawlerConfig, url: string) {
  // Validate URL before fetching
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Strip protocol from input URL and construct full URL with Jina prefix
  // Jina Reader expects: https://r.jina.ai/http://example.com or https://r.jina.ai/https://example.com
  const prefix = config.JINA_READER_PREFIX;
  const urlWithoutProtocol = url.replace(/^https?:\/\//, "");
  const fullUrl = `${prefix}${urlWithoutProtocol}`;

  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(fullUrl, {
      headers: { "user-agent": "ai-news-crawler/0.1" },
      signal: controller.signal,
    });

    // Check content length before downloading
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
      throw new Error(
        `Content too large: ${contentLength} bytes (max ${MAX_CONTENT_SIZE})`,
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Jina fetch failed for ${url}: ${res.status} ${errorText}`,
      );
    }

    const content = await res.text();

    // Check actual content size
    if (content.length > MAX_CONTENT_SIZE) {
      throw new Error(
        `Content too large: ${content.length} chars (max ${MAX_CONTENT_SIZE})`,
      );
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}
