'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

interface SearchFiltersProps {
  categories: string[];
  sourceCategories: string[];
}

export function SearchFilters({ categories, sourceCategories }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current filter values from URL
  const currentCategory = searchParams.getAll('category');
  const currentSourceCategory = searchParams.getAll('sourceCategory');
  const currentLanguage = searchParams.getAll('language');
  const currentTags = searchParams.getAll('tags');
  const currentMinImportance = searchParams.get('minImportance');
  const currentMaxImportance = searchParams.get('maxImportance');
  const currentStartDate = searchParams.get('startDate');
  const currentEndDate = searchParams.get('endDate');
  const currentSortBy = searchParams.get('sortBy') ?? 'relevance';

  const hasActiveFilters =
    currentCategory.length > 0 ||
    currentSourceCategory.length > 0 ||
    currentLanguage.length > 0 ||
    currentTags.length > 0 ||
    currentMinImportance !== null ||
    currentMaxImportance !== null ||
    currentStartDate !== null ||
    currentEndDate !== null;

  const updateFilters = useCallback(
    (updates: Record<string, string | string[] | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.delete(key);
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }

      router.push(`/search?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const toggleFilter = useCallback(
    (key: string, value: string) => {
      const current = searchParams.getAll(key);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateFilters({ [key]: updated });
    },
    [searchParams, updateFilters]
  );

  const clearAllFilters = useCallback(() => {
    const q = searchParams.get('q') ?? '';
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [searchParams, router]);

  return (
    <div className="space-y-4">
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-black">
              {[
                currentCategory.length,
                currentSourceCategory.length,
                currentLanguage.length,
                currentTags.length,
                currentMinImportance ? 1 : 0,
                currentMaxImportance ? 1 : 0,
                currentStartDate ? 1 : 0,
                currentEndDate ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          {/* Sort By */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sort by
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'relevance', label: 'Relevance' },
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'importance', label: 'Importance' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateFilters({ sortBy: option.value })}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    currentSortBy === option.value
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Filter */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Language
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'en', label: 'English' },
                { value: 'zh', label: 'Chinese' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleFilter('language', option.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    currentLanguage.includes(option.value)
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleFilter('category', cat)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                      currentCategory.includes(cat)
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Source Category Filter */}
          {sourceCategories.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Source Type
              </label>
              <div className="flex flex-wrap gap-2">
                {sourceCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleFilter('sourceCategory', cat)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                      currentSourceCategory.includes(cat)
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Importance Range */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Importance Score
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '80', label: '80+' },
                { value: '60', label: '60+' },
                { value: '40', label: '40+' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateFilters({
                      minImportance: currentMinImportance === option.value ? null : option.value,
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    currentMinImportance === option.value
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '1', label: 'Past 24h' },
                { value: '7', label: 'Past Week' },
                { value: '30', label: 'Past Month' },
                { value: '90', label: 'Past 3 Months' },
              ].map((option) => {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - Number(option.value));
                const startDateStr = startDate.toISOString().split('T')[0];

                const isCurrentlyActive = currentStartDate === startDateStr;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateFilters({
                        startDate: isCurrentlyActive ? undefined : startDateStr,
                        endDate: isCurrentlyActive ? undefined : undefined,
                      })
                    }
                    className={`rounded-lg px-3 py-1.5 text-sm transition ${
                      isCurrentlyActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <span className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Active filters
              </span>
              <div className="flex flex-wrap gap-2">
                {currentCategory.map((v) => (
                  <span
                    key={`cat-${v}`}
                    className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {v}
                    <button
                      type="button"
                      onClick={() => toggleFilter('category', v)}
                      className="hover:text-zinc-900 dark:hover:text-white"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
                {currentLanguage.map((v) => (
                  <span
                    key={`lang-${v}`}
                    className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {v === 'en' ? 'English' : 'Chinese'}
                    <button
                      type="button"
                      onClick={() => toggleFilter('language', v)}
                      className="hover:text-zinc-900 dark:hover:text-white"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
                {currentMinImportance && (
                  <span className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Importance: {currentMinImportance}+
                    <button
                      type="button"
                      onClick={() => updateFilters({ minImportance: undefined })}
                      className="hover:text-zinc-900 dark:hover:text-white"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
