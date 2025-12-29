import Link from 'next/link';

import { NewsGrid } from '@/components/news/NewsGrid';
import { listNews } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ cursor?: string }>;
}) {
  const { category: categoryRaw } = await params;
  const category = decodeURIComponent(categoryRaw);
  const sp = (await searchParams) ?? {};
  const cursor = sp.cursor ?? null;
  const { items, nextCursor } = await listNews({
    limit: 30,
    cursor,
    category,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{category}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Category: <span className="font-medium">{category}</span>
        </p>
      </div>

      <NewsGrid items={items} />

      <div className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">
          ← Home
        </Link>
        {nextCursor ? (
          <Link
            href={{
              pathname: `/category/${encodeURIComponent(category)}`,
              query: { cursor: nextCursor },
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
          >
            Next →
          </Link>
        ) : (
          <span className="text-sm text-zinc-400">No more</span>
        )}
      </div>
    </div>
  );
}
