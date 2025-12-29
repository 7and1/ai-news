/**
 * Jina Reader fetcher for full-text content extraction.
 * Uses Jina AI's reader API to fetch clean, readable content.
 */

import type { CrawlerConfig } from './types';

/**
 * Fetch full-text content from a URL using Jina Reader.
 *
 * Jina Reader extracts the main content from web pages and returns
 * it in a clean, readable format (Markdown by default).
 */
export async function fetchFullContent(
  config: CrawlerConfig,
  url: string,
  format: 'markdown' | 'text' | 'html' = 'markdown'
): Promise<string> {
  const prefix = config.jinaReaderPrefix;

  // Construct the Jina Reader URL
  // Jina supports: https://r.jina.ai/http://URL or https://r.jina.ai/http://URL?format=markdown
  const fetchUrl = new URL(prefix + url);

  if (format !== 'markdown') {
    fetchUrl.searchParams.set('format', format);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.jinaTimeout);

  try {
    const response = await fetch(fetchUrl.toString(), {
      headers: {
        'User-Agent': 'BestBlogs-Crawler/1.0',
        Accept: 'text/plain, text/markdown, text/html',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new JinaFetchError(
        `Jina fetch failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const content = await response.text();

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new JinaFetchError('Jina returned empty content', 200, url);
    }

    // Check for error messages in the response
    if (content.includes('Jina AI') && content.includes('error')) {
      throw new JinaFetchError(`Jina returned error: ${content}`, 200, url);
    }

    return content.trim();
  } catch (error) {
    if (error instanceof JinaFetchError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new JinaFetchError(`Jina fetch timeout after ${config.jinaTimeout}ms`, 408, url);
    }

    throw new JinaFetchError(
      `Jina fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      0,
      url
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Custom error for Jina fetch failures.
 */
export class JinaFetchError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public url: string
  ) {
    super(message);
    this.name = 'JinaFetchError';
  }

  /**
   * Check if the error is retryable.
   */
  isRetryable(): boolean {
    // Retry on timeouts, rate limits (429), and server errors (5xx)
    return (
      this.statusCode === 408 ||
      this.statusCode === 429 ||
      (this.statusCode >= 500 && this.statusCode < 600) ||
      this.statusCode === 0
    );
  }

  /**
   * Get suggested delay before retry (in milliseconds).
   */
  getRetryDelay(): number {
    if (this.statusCode === 429) {
      // Rate limited: wait 60 seconds
      return 60000;
    }

    if (this.statusCode === 408 || this.statusCode >= 500) {
      // Timeout or server error: exponential backoff (5-30 seconds)
      return 5000 + Math.random() * 25000;
    }

    // Default: 10 seconds
    return 10000;
  }
}

/**
 * Check if a URL should be fetched with Jina Reader.
 */
export function shouldUseJina(sourceType: string, needCrawl: boolean): boolean {
  if (!needCrawl) {
    return false;
  }

  // Jina works well with these source types
  const validTypes = new Set(['article', 'blog', 'news', 'newsletter', 'wechat']);

  return validTypes.has(sourceType);
}

/**
 * Fallback content extraction when Jina fails.
 * Tries to fetch the original page and extract text.
 */
export async function fallbackContentExtract(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BestBlogs-Crawler/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();

    // Very basic text extraction
    // Remove scripts, styles, and other non-content elements
    const withoutScripts = html.replace(
      /<(script|style|nav|header|footer|aside)[\s\S]*?<\/\1>/gi,
      ''
    );
    const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    const text = withoutTags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up whitespace
    return text
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .join(' ')
      .slice(0, 10000); // Limit to 10k characters
  } catch {
    return '';
  }
}

/**
 * Fetch content with retry logic.
 */
export async function fetchContentWithRetry(
  config: CrawlerConfig,
  url: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFullContent(config, url);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof JinaFetchError) {
        if (!error.isRetryable() || attempt >= maxRetries) {
          break;
        }

        // Wait before retry
        const delay = error.getRetryDelay() * (attempt + 1); // Exponential backoff
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  // All retries failed, try fallback
  const fallback = await fallbackContentExtract(url);
  if (fallback) {
    return fallback;
  }

  throw lastError || new Error('Failed to fetch content');
}

/**
 * Sleep helper for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch fetch multiple URLs with concurrency control.
 */
export async function batchFetchContent(
  config: CrawlerConfig,
  urls: string[],
  concurrency: number = 3
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const errors = new Map<string, Error>();

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const content = await fetchContentWithRetry(config, url, 2);
          results.set(url, content);
        } catch (error) {
          errors.set(url, error as Error);
        }
      })
    );
  }

  return results;
}

/**
 * Check if Jina Reader is available.
 */
export async function checkJinaHealth(prefix: string): Promise<boolean> {
  try {
    const response = await fetch(prefix + 'https://example.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
