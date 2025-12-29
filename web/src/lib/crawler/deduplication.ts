/**
 * Content deduplication for RSS feeds.
 * Detects duplicate and near-duplicate articles.
 */

import { createHash } from 'crypto';

/**
 * Generate a content hash for deduplication.
 */
export function generateContentHash(input: {
  url?: string;
  title: string;
  content?: string;
}): string {
  // Normalize URL for hashing (remove tracking params, etc.)
  const normalizedUrl = input.url ? normalizeUrl(input.url) : '';

  // Normalize title
  const normalizedTitle = input.title.toLowerCase().replace(/\s+/g, ' ').trim();

  // Create hash from URL + title (content is optional)
  const data = `${normalizedUrl}|${normalizedTitle}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate URL-based ID (for backwards compatibility).
 */
export function idFromUrl(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Normalize URL for comparison (remove tracking parameters, etc.).
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'msclkid',
      '_ga',
      'ref',
      'ref_source',
      'referrer',
    ];

    for (const param of trackingParams) {
      urlObj.searchParams.delete(param);
    }

    // Remove fragment
    urlObj.hash = '';

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Check if two URLs are likely the same content (normalized comparison).
 */
export function areUrlsSimilar(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Calculate similarity ratio between two strings (Jaccard-like).
 */
export function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if two titles are likely duplicates.
 */
export function areTitlesSimilar(title1: string, title2: string): boolean {
  const similarity = textSimilarity(title1, title2);
  return similarity > 0.7; // 70% similarity threshold
}

/**
 * Extract a canonical URL from HTML (if available).
 */
export function extractCanonicalUrl(html: string, baseUrl: string): string | null {
  // Try to find canonical link
  const canonicalMatch = html.match(
    /<link[^>]*rel=["'](?:canonical|alternate)[^>]*href=["']([^"']+)["']/i
  );

  if (canonicalMatch && canonicalMatch[1]) {
    try {
      return new URL(canonicalMatch[1], baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Batch deduplicate articles by URL.
 */
export function deduplicateByUrl<T extends { url: string }>(items: T[]): Map<string, T> {
  const unique = new Map<string, T>();

  for (const item of items) {
    const normalized = normalizeUrl(item.url);
    if (!unique.has(normalized)) {
      unique.set(normalized, item);
    }
  }

  return unique;
}

/**
 * Batch deduplicate articles by title similarity.
 */
export function deduplicateByTitle<T extends { title: string }>(
  items: T[],
  threshold: number = 0.75
): T[] {
  const result: T[] = [];
  const seenTitles: string[] = [];

  for (const item of items) {
    const itemTitle = item.title.toLowerCase().trim();

    // Check if similar to any seen title
    const isDuplicate = seenTitles.some((seen) => {
      const similarity = textSimilarity(itemTitle, seen);
      return similarity >= threshold;
    });

    if (!isDuplicate) {
      result.push(item);
      seenTitles.push(itemTitle);
    }
  }

  return result;
}

/**
 * Fingerprint for near-duplicate detection.
 */
export function contentFingerprint(content: string): string {
  // Remove punctuation and normalize whitespace
  const cleaned = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Create word n-grams (3-grams)
  const words = cleaned.split(/\s+/);
  const ngrams: string[] = [];

  for (let i = 0; i <= words.length - 3; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  // Sample n-grams for fingerprint
  const sampleSize = Math.min(ngrams.length, 100);
  const step = Math.max(1, Math.floor(ngrams.length / sampleSize));
  const sampled = ngrams.filter((_, i) => i % step === 0);

  return createHash('sha256').update(sampled.join('|')).digest('hex').slice(0, 16);
}

/**
 * Check if two pieces of content are near-duplicates.
 */
export function areNearDuplicates(content1: string, content2: string): boolean {
  const fp1 = contentFingerprint(content1);
  const fp2 = contentFingerprint(content2);
  return fp1 === fp2;
}

/**
 * Remove near-duplicate items from a list.
 */
export function deduplicateNearDuplicates<T extends { content?: string }>(items: T[]): T[] {
  const seenFingerprints = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (!item.content) {
      result.push(item);
      continue;
    }

    const fp = contentFingerprint(item.content);
    if (!seenFingerprints.has(fp)) {
      seenFingerprints.add(fp);
      result.push(item);
    }
  }

  return result;
}
