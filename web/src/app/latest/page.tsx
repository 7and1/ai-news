import Link from 'next/link';
import { Suspense } from 'react';

import { NewsFilters } from '@/components/news/NewsFilters';
import { NewsGrid } from '@/components/news/NewsGrid';
import { listNews } from '@/lib/db/queries';

// =============================================================================
// CACHE CONFIGURATION - SSR with revalidation for optimal performance
// =============================================================================
// Revalidate every 2 minutes (120 seconds) for latest news
export const revalidate = 120;
export const dynamic = 'force-dynamic'; // Use SSR since D1 bindings not available at build

export default async function LatestPage({
  searchParams,
}: {
  searchParams?: Promise<{
    cursor?: string;
    lang?: string;
    category?: string;
    min?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const minImportance = sp.min ? Number(sp.min) : 0;
  const language = sp.lang ?? null;
  const category = sp.category ?? null;
  const cursor = sp.cursor ?? null;

  const { items, nextCursor } = await listNews({
    limit: 30,
    cursor,
    minImportance: Number.isFinite(minImportance) ? minImportance : 0,
    language,
    category,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Latest</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Real-time feed across sources. Filter by language, category, or importance.
          </p>
        </div>
        <Suspense fallback={<div className="h-9" />}>
          <NewsFilters
            currentLang={sp.lang ?? ''}
            currentCategory={sp.category ?? ''}
            currentMin={sp.min ?? '0'}
          />
        </Suspense>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          No articles found matching your filters. Try adjusting your criteria.
        </div>
      ) : (
        <NewsGrid items={items} />
      )}

      <div className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">
          &larr; Home
        </Link>
        {nextCursor ? (
          <Link
            href={{
              pathname: '/latest',
              query: {
                cursor: nextCursor,
                ...(language ? { lang: language } : null),
                ...(category ? { category } : null),
                ...(minImportance ? { min: String(minImportance) } : null),
              },
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
          >
            Next &rarr;
          </Link>
        ) : (
          <span className="text-sm text-zinc-400">No more</span>
        )}
      </div>
    </div>
  );
}
