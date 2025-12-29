import { format } from 'date-fns';
import Link from 'next/link';

import type { NewsListItem } from '@/lib/db/types';

import { TagPill } from './TagPill';

// =============================================================================
// NEWS CARD - Performance optimized component
// =============================================================================
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export function NewsCard({ item }: { item: NewsListItem }) {
  const description = item.oneLine ?? item.summary ?? null;
  return (
    <article className="news-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-black">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base leading-6 font-semibold text-zinc-950 dark:text-zinc-50">
          <Link className="hover:underline" href={`/news/${item.id}`}>
            {stripHtmlTags(item.title)}
          </Link>
        </h2>
        <div className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {item.importance}
        </div>
      </div>

      {description && (
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {stripHtmlTags(description)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.sourceName}</span>
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
            <TagPill key={t} tag={t} />
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-zinc-600 hover:underline dark:text-zinc-300"
        >
          Read original
        </a>
      </div>
    </article>
  );
}
