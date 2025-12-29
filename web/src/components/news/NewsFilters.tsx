'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type FilterProps = {
  languages: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  importanceLevels: { value: string; label: string }[];
};

const defaultFilters: FilterProps = {
  languages: [
    { value: '', label: 'All languages' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
  ],
  categories: [
    { value: '', label: 'All categories' },
    { value: 'release', label: 'Releases' },
    { value: 'research', label: 'Research' },
    { value: 'business', label: 'Business' },
    { value: 'news', label: 'News' },
    { value: 'security', label: 'Security' },
    { value: 'policy', label: 'Policy' },
  ],
  importanceLevels: [
    { value: '0', label: 'All' },
    { value: '50', label: '50+' },
    { value: '70', label: '70+' },
    { value: '80', label: '80+' },
  ],
};

export function NewsFilters({
  currentLang = '',
  currentCategory = '',
  currentMin = '0',
}: {
  currentLang?: string;
  currentCategory?: string;
  currentMin?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('cursor');
      router.push(`/latest?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentLang}
        onChange={(e) => updateFilter('lang', e.target.value)}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm ring-zinc-400 outline-none focus:ring-2 dark:border-zinc-800 dark:bg-black"
      >
        {defaultFilters.languages.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <select
        value={currentCategory}
        onChange={(e) => updateFilter('category', e.target.value)}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm ring-zinc-400 outline-none focus:ring-2 dark:border-zinc-800 dark:bg-black"
      >
        {defaultFilters.categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={currentMin}
        onChange={(e) => updateFilter('min', e.target.value)}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm ring-zinc-400 outline-none focus:ring-2 dark:border-zinc-800 dark:bg-black"
      >
        {defaultFilters.importanceLevels.map((i) => (
          <option key={i.value} value={i.value}>
            Importance: {i.label}
          </option>
        ))}
      </select>
    </div>
  );
}
