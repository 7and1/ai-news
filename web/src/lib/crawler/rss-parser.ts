/**
 * RSS feed parser for Cloudflare Workers.
 * Parses RSS/Atom feeds and extracts article data.
 */

import type { RssFeed, RssItem, Source } from './types';

/**
 * Parse RSS feed from URL or content string.
 */
export async function parseRssFeed(input: string | URL): Promise<RssFeed> {
  let url: URL;

  if (typeof input === 'string') {
    try {
      url = new URL(input);
    } catch {
      // Input is raw XML content
      return parseRssXml(input);
    }
  } else {
    url = input;
  }

  // Fetch RSS content
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'BestBlogs-Crawler/1.0',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  return parseRssXml(content);
}

/**
 * Parse RSS/Atom XML content.
 */
function parseRssXml(xmlContent: string): RssFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent}`);
  }

  // Determine feed format (RSS or Atom)
  const rssRoot = doc.querySelector('rss');
  const atomRoot = doc.querySelector('feed');

  if (rssRoot) {
    return parseRss(doc);
  } else if (atomRoot) {
    return parseAtom(doc);
  }

  throw new Error('Unknown feed format (not RSS or Atom)');
}

/**
 * Parse RSS 2.0 format.
 */
function parseRss(doc: Document): RssFeed {
  const channel = doc.querySelector('channel');
  if (!channel) {
    throw new Error('Invalid RSS feed: missing channel element');
  }

  const title = getTextContent(channel, 'title');
  const description = getTextContent(channel, 'description');
  const link = getTextContent(channel, 'link');

  const itemElements = channel.querySelectorAll('item');
  const items = Array.from(itemElements).map(parseRssItem);

  return {
    title,
    description,
    link,
    items,
  };
}

/**
 * Parse Atom feed format.
 */
function parseAtom(doc: Document): RssFeed {
  const feed = doc.querySelector('feed');
  if (!feed) {
    throw new Error('Invalid Atom feed: missing feed element');
  }

  const title = getTextContent(feed, 'title');
  const description = getTextContent(feed, 'subtitle');
  const link = getAttributeContent(feed, 'link', 'href');

  const entryElements = feed.querySelectorAll('entry');
  const items = Array.from(entryElements).map(parseAtomEntry);

  return {
    title,
    description,
    link,
    items,
  };
}

/**
 * Parse RSS item.
 */
function parseRssItem(item: Element): RssItem {
  const title = getTextContent(item, 'title');
  const link = getTextContent(item, 'link');
  const guid = getTextContent(item, 'guid');
  const pubDate = getTextContent(item, 'pubDate');
  const content = getTextContent(item, 'content:encoded') || getTextContent(item, 'content');
  const contentSnippet = getTextContent(item, 'description');

  // Extract categories
  const categoryElements = item.querySelectorAll('category');
  const categories = Array.from(categoryElements)
    .map((cat) => cat.textContent?.trim())
    .filter((cat): cat is string => Boolean(cat));

  return {
    title,
    link,
    guid,
    pubDate,
    isoDate: pubDate ? new Date(pubDate).toISOString() : undefined,
    content: content || undefined,
    contentSnippet: contentSnippet || undefined,
    'content:encoded': content || undefined,
    categories: categories.length > 0 ? categories : undefined,
  };
}

/**
 * Parse Atom entry.
 */
function parseAtomEntry(entry: Element): RssItem {
  const title = getTextContent(entry, 'title');
  const link = getAttributeContent(entry, 'link', 'href');
  const guid = getTextContent(entry, 'id');
  const pubDate = getTextContent(entry, 'published') || getTextContent(entry, 'updated');
  const content = getTextContent(entry, 'content');
  const contentSnippet = getTextContent(entry, 'summary');

  // Extract categories
  const categoryElements = entry.querySelectorAll('category');
  const categories = Array.from(categoryElements)
    .map((cat) => cat.getAttribute('term'))
    .filter((cat): cat is string => Boolean(cat));

  return {
    title,
    link,
    guid,
    pubDate,
    isoDate: pubDate ? new Date(pubDate).toISOString() : undefined,
    content: content || undefined,
    contentSnippet: contentSnippet || undefined,
    categories: categories.length > 0 ? categories : undefined,
  };
}

/**
 * Get text content of a child element.
 */
function getTextContent(parent: Element, selector: string): string {
  const element = parent.querySelector(selector);
  return element?.textContent?.trim() || '';
}

/**
 * Get attribute content of a child element.
 */
function getAttributeContent(parent: Element, selector: string, attribute: string): string {
  const element = parent.querySelector(selector);
  return element?.getAttribute(attribute)?.trim() || '';
}

/**
 * Extract URL from RSS item (tries multiple fields).
 */
export function extractUrl(item: RssItem): string | null {
  const url = item.link || item.guid;
  if (!url) {
    return null;
  }

  // Validate URL format
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Extract publication date from RSS item.
 */
export function extractPublishedAt(item: RssItem): number {
  if (item.isoDate) {
    const date = new Date(item.isoDate);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  if (item.pubDate) {
    const date = new Date(item.pubDate);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Default to current time
  return Date.now();
}

/**
 * Extract content from RSS item with fallbacks.
 */
export function extractContent(item: RssItem): string {
  return (item['content:encoded'] || item.content || item.contentSnippet || '').trim();
}

/**
 * Guess content format from content string.
 */
export function guessContentFormat(content: string): 'html' | 'markdown' | 'text' {
  if (!content) {
    return 'text';
  }

  // Check for HTML tags
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return 'html';
  }

  // Check for Markdown syntax (has headings and newlines)
  if (content.includes('\n') && /^#{1,6}\s/m.test(content)) {
    return 'markdown';
  }

  return 'text';
}

/**
 * Validate RSS item for processing.
 */
export function isValidItem(item: RssItem): boolean {
  const url = extractUrl(item);
  const title = item.title?.trim();

  return Boolean(url && title);
}

/**
 * Filter and sort RSS items by relevance.
 */
export function filterAndSortItems(
  items: RssItem[],
  maxItems: number,
  maxAgeDays: number = 30
): RssItem[] {
  const cutoffDate = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  return items
    .filter((item) => {
      // Must have valid URL and title
      if (!isValidItem(item)) {
        return false;
      }

      // Filter out items older than cutoff
      const publishedAt = extractPublishedAt(item);
      return publishedAt > cutoffDate;
    })
    .sort((a, b) => {
      // Sort by publication date (newest first)
      const dateA = extractPublishedAt(a);
      const dateB = extractPublishedAt(b);
      return dateB - dateA;
    })
    .slice(0, maxItems);
}

/**
 * Extract metadata for special source types.
 */
export function extractSourceMetadata(
  _source: Source,
  _feed: RssFeed
): {
  itunesAuthor?: string;
  itunesImage?: string;
  language?: string;
} {
  const metadata: {
    itunesAuthor?: string;
    itunesImage?: string;
    language?: string;
  } = {};

  // For podcast sources, try to extract iTunes namespace data
  // TODO: Implement iTunes namespace parsing

  return metadata;
}
