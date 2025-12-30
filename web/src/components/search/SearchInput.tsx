'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchInputProps {
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showPopular?: boolean;
}

interface Suggestion {
  text: string;
  type: 'query' | 'title' | 'tag' | 'entity';
}

export function SearchInput({
  defaultValue = '',
  placeholder = 'Search (e.g., OpenAI, GPT-5, agents)',
  autoFocus = false,
  showPopular = true,
}: SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<{ query: string; count: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
      }
    } catch {
      // Ignore storage errors
    }

    // Load popular searches
    if (showPopular) {
      fetch('/api/search/analytics?type=popular&limit=5')
        .then((res) => res.json())
        .then((data) => {
          if (data.queries) {
            setPopularSearches(data.queries);
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [showPopular]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear or close suggestions
      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false);
          setSelectedIndex(-1);
        } else {
          setQuery('');
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        const combined: Suggestion[] = data.suggestions.map((s: string, i: number) => ({
          text: s,
          type: data.types?.[i] || 'query',
        }));
        setSuggestions(combined);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        void fetchSuggestions(query);
      }, 200);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }

    // Save to recent searches
    const newRecent = [query.trim(), ...recentSearches.filter((s) => s !== query.trim())].slice(
      0,
      10
    );
    setRecentSearches(newRecent);
    try {
      localStorage.setItem('recentSearches', JSON.stringify(newRecent));
    } catch {
      // Ignore storage errors
    }

    // Navigate to search results
    const params = new URLSearchParams();
    params.set('q', query.trim());
    router.push(`/search?${params.toString()}`);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex].text);
        }
        break;
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recentSearches');
    } catch {
      // Ignore storage errors
    }
  };

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'tag':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        );
      case 'title':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case 'entity':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400"
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
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="h-12 w-full rounded-xl border border-zinc-200 bg-white py-3 pr-12 pl-10 text-sm ring-zinc-400 transition outline-none placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-800 dark:bg-black dark:placeholder:text-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-12 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Clear search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-400 sm:inline-block dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-xs">⌘K</span>
          </kbd>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions &&
        (query.length >= 2 || recentSearches.length > 0 || popularSearches.length > 0) && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-black">
            {isLoading && query.length >= 2 && (
              <div className="flex items-center justify-center px-4 py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
              </div>
            )}

            {!isLoading && suggestions.length > 0 && (
              <div className="max-h-80 overflow-y-auto">
                <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.text}-${suggestion.type}-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                      index === selectedIndex
                        ? 'bg-zinc-100 dark:bg-zinc-900'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="text-zinc-400">{getSuggestionIcon(suggestion.type)}</span>
                    <span className="flex-1 truncate text-zinc-900 dark:text-zinc-100">
                      {suggestion.text}
                    </span>
                    <span className="text-xs text-zinc-400 capitalize">{suggestion.type}</span>
                  </button>
                ))}
              </div>
            )}

            {!isLoading && query.length < 2 && (
              <div className="max-h-80 overflow-y-auto">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <>
                    <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Recent
                      </span>
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        Clear
                      </button>
                    </div>
                    {recentSearches.map((search, index) => (
                      <button
                        key={`recent-${index}`}
                        type="button"
                        onClick={() => handleSuggestionClick(search)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <svg
                          className="h-4 w-4 text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="flex-1 truncate text-zinc-900 dark:text-zinc-100">
                          {search}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* Popular Searches */}
                {showPopular && popularSearches.length > 0 && (
                  <>
                    {recentSearches.length > 0 && (
                      <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Trending
                      </div>
                    )}
                    {popularSearches.map((item, index) => (
                      <button
                        key={`popular-${index}`}
                        type="button"
                        onClick={() => handleSuggestionClick(item.query)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <svg
                          className="h-4 w-4 text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                        <span className="flex-1 truncate text-zinc-900 dark:text-zinc-100">
                          {item.query}
                        </span>
                        <span className="text-xs text-zinc-400">{item.count} searches</span>
                      </button>
                    ))}
                  </>
                )}

                {recentSearches.length === 0 && popularSearches.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-zinc-400">
                    Try searching for topics, companies, or technologies
                  </div>
                )}
              </div>
            )}

            {!isLoading && query.length >= 2 && suggestions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-400">
                No suggestions found
              </div>
            )}

            {/* Search Tips */}
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="text-xs text-zinc-400">
                <span className="font-medium">Tips:</span> Use quotes for exact phrases,{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">tag:name</code>{' '}
                for tags
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
