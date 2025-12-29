'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

import type { NewsListItem } from '@/lib/db/types';

import { SearchFilters } from './SearchFilters';

interface SearchResultsProps {
  initialItems: NewsListItem[];
  initialNextCursor: string | null;
  initialTotal?: number;
  categories: string[];
  sourceCategories: string[];
}

export function SearchResults({
  initialItems,
  initialNextCursor,
  initialTotal,
  categories,
  sourceCategories,
}: SearchResultsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [items, setItems] = useState<NewsListItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | undefined>(initialTotal);
  const hasTrackedRef = useRef(false);

  // Track search analytics
  useEffect(() => {
    if (q && !hasTrackedRef.current) {
      hasTrackedRef.current = true;
      fetch('/api/search/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'search',
          query: q,
          resultsCount: items.length,
        }),
      }).catch(() => {
        // Silently fail
      });
    }
  }, [q, items.length]); // Only track on mount

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {return;}

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (nextCursor) {
        params.set('cursor', nextCursor);
      }

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();

      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      if (data.total !== undefined) {
        setTotal(data.total);
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleClick = (newsId: string) => {
    // Track click-through
    fetch('/api/search/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'click',
        queryId: `search_${Date.now()}`,
        newsId,
      }),
    }).catch(() => {
      // Silently fail
    });
  };

  // Get related searches based on tags from results
  const relatedSearches = items
    .flatMap((item) => item.tags.slice(0, 2))
    .filter((tag, i, arr) => arr.indexOf(tag) === i)
    .slice(0, 8);

  const highlightTerm = (text: string, term: string) => {
    if (!term) {return text;}
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(
      regex,
      '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>'
    );
  };

  const getSearchTerms = (query: string): string[] => {
    // Extract search terms from query, excluding operators
    return query
      .replace(/[+"-]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !t.includes(':'))
      .slice(0, 3);
  };

  const searchTerms = getSearchTerms(q);

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {q ? `Search results for "${q}"` : 'All results'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {total !== undefined
              ? `${total.toLocaleString()} results found`
              : `${items.length} results`}
            {searchParams.toString() && (
              <button
                type="button"
                onClick={() => router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')}
                className="ml-2 underline hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <SearchFilters categories={categories} sourceCategories={sourceCategories} />

      {/* Results */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <svg
            className="mx-auto h-12 w-12 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            No results found
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search terms or filters
          </p>
          <div className="mt-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-500">Search tips:</p>
            <ul className="mt-2 space-y-1 text-left text-sm text-zinc-500 dark:text-zinc-500">
              <li>• Use specific keywords instead of general terms</li>
              <li>• Try different spellings or synonyms</li>
              <li>• Use quotes for exact phrases: &quot;machine learning&quot;</li>
              <li>• Use tag:filter for specific tags: tag:opensource</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-black"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex-1 text-base leading-6 font-semibold text-zinc-950 dark:text-zinc-50">
                  <Link
                    className="hover:underline"
                    href={`/news/${item.id}`}
                    onClick={() => handleClick(item.id)}
                    dangerouslySetInnerHTML={{
                      __html:
                        searchTerms.length > 0 && searchTerms[0]
                          ? highlightTerm(item.title, searchTerms[0])
                          : item.title,
                    }}
                  />
                </h2>
                <div className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {item.importance}
                </div>
              </div>

              {(item.oneLine || item.summary) && (
                <p
                  className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
                  dangerouslySetInnerHTML={{
                    __html:
                      searchTerms.length > 0 && searchTerms[0] && item.summary
                        ? highlightTerm(item.oneLine || item.summary, searchTerms[0])
                        : item.oneLine || item.summary || '',
                  }}
                />
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {item.sourceName}
                </span>
                <span>•</span>
                <time dateTime={new Date(item.publishedAt).toISOString()}>
                  {format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm')}
                </time>
                {item.category && (
                  <>
                    <span>•</span>
                    <Link
                      className="hover:underline"
                      href={`/category/${encodeURIComponent(item.category)}`}
                    >
                      {item.category}
                    </Link>
                  </>
                )}
                <span className="w-full" />
                <div className="flex flex-wrap gap-2">
                  {item.tags.slice(0, 6).map((t) => (
                    <Link
                      key={t}
                      href={`/search?q=${encodeURIComponent(`tag:${t}`)}`}
                      className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-xs">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-zinc-600 hover:underline dark:text-zinc-300"
                  onClick={() => handleClick(item.id)}
                >
                  Read original
                </a>
              </div>
            </article>
          ))}

          {/* Load More */}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => {
                  void handleLoadMore();
                }}
                disabled={isLoadingMore}
                className="rounded-lg border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
                    Loading...
                  </span>
                ) : (
                  'Load more results'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Related Searches */}
      {relatedSearches.length > 0 && items.length > 0 && (
        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Related topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedSearches.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
