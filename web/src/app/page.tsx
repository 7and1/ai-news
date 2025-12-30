import Link from 'next/link';

import { NewsGrid } from '@/components/news/NewsGrid';
import { TagPill } from '@/components/news/TagPill';
import { listNews, listTopTags } from '@/lib/db/queries';
import { generateWebSiteJsonLd } from '@/lib/seo';

// =============================================================================
// CACHE CONFIGURATION - SSR with revalidation for optimal performance
// =============================================================================
// Revalidate every 5 minutes (300 seconds) for fresh content
export const revalidate = 300;
export const dynamic = 'force-dynamic'; // Use SSR since D1 bindings not available at build

export default async function HomePage() {
  const [{ items }, topTags] = await Promise.all([
    listNews({ limit: 20, minImportance: 50 }),
    listTopTags({ limit: 24, minImportance: 50 }),
  ]);
  const jsonLd = await generateWebSiteJsonLd();

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">AI News</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Aggregated from official blogs, AI media, and selected accounts. Focus on high-signal
          updates.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2 text-sm">
          <Link
            href="/latest"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Browse latest
          </Link>
          <Link
            href="/search"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Search
          </Link>
        </div>
      </section>

      {topTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Trending tags
            </h2>
            <Link
              href="/latest"
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-300"
            >
              View all →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {topTags.map((t) => (
              <TagPill key={t.tag} tag={t.tag} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top stories</h2>
          <Link href="/latest" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">
            Latest →
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            No items yet. Run `npm run d1:migrate:local` and `npm run d1:seed:local` (or ingest via
            API) to populate data.
          </div>
        ) : (
          <NewsGrid items={items} />
        )}
      </section>
    </div>
  );
}
