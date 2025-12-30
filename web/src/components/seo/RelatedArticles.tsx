import { format } from 'date-fns';
import Link from 'next/link';

import type { NewsListItem } from '@/lib/db/types';

interface RelatedArticlesProps {
  articles: NewsListItem[];
  title?: string;
}

export function RelatedArticles({ articles, title = 'Related Articles' }: RelatedArticlesProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <ul className="space-y-2">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={`/news/${article.id}`}
              className="group block text-sm leading-snug text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <span className="group-hover:underline">{article.title}</span>
              <time
                className="mt-1 block text-xs text-zinc-500"
                dateTime={new Date(article.publishedAt).toISOString()}
              >
                {format(new Date(article.publishedAt), 'MMM d, yyyy')}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
