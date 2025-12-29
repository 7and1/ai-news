import { Suspense } from 'react';

import { SearchInput, SearchResults } from '@/components/search';
import { advancedSearch } from '@/lib/db/search-queries';

export const dynamic = 'force-dynamic';

// Define available categories and source categories
const CATEGORIES = [
  'Artificial_Intelligence',
  'Business_Tech',
  'Programming_Technology',
  'Product_Development',
];

const SOURCE_CATEGORIES = ['ai_company', 'ai_media', 'ai_kol', 'ai_tool'];

interface SearchPageProps {
  searchParams?: Promise<{
    q?: string;
    cursor?: string;
    category?: string | string[];
    sourceCategory?: string | string[];
    sourceId?: string | string[];
    language?: string | string[];
    tags?: string | string[];
    startDate?: string;
    endDate?: string;
    minImportance?: string;
    maxImportance?: string;
    sortBy?: string;
    fields?: string;
  }>;
}

async function SearchResultsWrapper({
  searchParams,
}: {
  searchParams: SearchPageProps['searchParams'];
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? '').trim();
  const cursor = sp.cursor ?? null;

  // Build advanced search params
  const searchParams_obj: Parameters<typeof advancedSearch>[0] = {
    q,
    limit: 30,
    cursor,
  };

  if (sp.category) {
    searchParams_obj.category = sp.category;
  }
  if (sp.sourceCategory) {
    searchParams_obj.sourceCategory = sp.sourceCategory;
  }
  if (sp.sourceId) {
    searchParams_obj.sourceId = sp.sourceId;
  }
  if (sp.language) {
    searchParams_obj.language = sp.language;
  }
  if (sp.tags) {
    searchParams_obj.tags = sp.tags;
  }
  if (sp.startDate) {
    searchParams_obj.startDate = sp.startDate;
  }
  if (sp.endDate) {
    searchParams_obj.endDate = sp.endDate;
  }
  if (sp.minImportance) {
    searchParams_obj.minImportance = Number(sp.minImportance);
  }
  if (sp.maxImportance) {
    searchParams_obj.maxImportance = Number(sp.maxImportance);
  }
  if (sp.sortBy) {
    searchParams_obj.sortBy = sp.sortBy as 'relevance' | 'newest' | 'oldest' | 'importance';
  }
  if (sp.fields) {
    searchParams_obj.fields = sp.fields.split(',') as (
      | 'all'
      | 'title'
      | 'summary'
      | 'content'
      | 'tags'
    )[];
  }

  const { items, nextCursor, total } = q
    ? await advancedSearch(searchParams_obj)
    : { items: [], nextCursor: null, total: 0 };

  return (
    <SearchResults
      initialItems={items}
      initialNextCursor={nextCursor}
      initialTotal={total}
      categories={CATEGORIES}
      sourceCategories={SOURCE_CATEGORIES}
    />
  );
}

function SearchPageFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Full-text search across titles, summaries, and content.
        </p>
      </div>
      <div className="flex h-32 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
      </div>
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = (await searchParams) ?? {};
  const q = sp.q ?? '';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Advanced full-text search with filters and suggestions.
        </p>
      </div>

      {/* Search Input */}
      <div className="sticky top-0 z-40 bg-white py-2 dark:bg-black">
        <SearchInput defaultValue={q} autoFocus={false} showPopular={true} />
      </div>

      {/* Search Results */}
      <Suspense fallback={<SearchPageFallback />}>
        <SearchResultsWrapper searchParams={searchParams} />
      </Suspense>

      {/* Search Tips */}
      {!q && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">Search Tips</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Exact Phrases
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Use quotes for exact phrase matching
              </p>
              <code className="mt-2 block rounded bg-white px-3 py-2 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                &quot;machine learning models&quot;
              </code>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tag Filters
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Filter by specific tags</p>
              <code className="mt-2 block rounded bg-white px-3 py-2 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                tag:opensource category:ai_company
              </code>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Wildcard Search
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Use * for prefix matching</p>
              <code className="mt-2 block rounded bg-white px-3 py-2 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                GPT* Claude*
              </code>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Date Filters
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Filter by date range</p>
              <code className="mt-2 block rounded bg-white px-3 py-2 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                after:2024-01-01 before:2024-12-31
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
