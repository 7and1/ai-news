import { format } from 'date-fns';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ShareButtons, estimateReadingTime } from '@/components/news/ShareButtons';
import { TagPill } from '@/components/news/TagPill';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import { RelatedArticles } from '@/components/seo/RelatedArticles';
import { getSiteUrl } from '@/lib/d1';
import { getRelatedArticlesByEntities } from '@/lib/db/pseo-queries';
import { getNewsById } from '@/lib/db/queries';
import type { BreadcrumbItem } from '@/lib/db/types';
import { linkEntitiesInContent, entitySlugToName } from '@/lib/entities';
import { generateNewsMetadata } from '@/lib/metadata';
import { generateBreadcrumbJsonLd } from '@/lib/pseo-seo';
import { generateNewsArticleJsonLd } from '@/lib/seo';

// =============================================================================
// CACHE CONFIGURATION - ISR for optimal performance
// =============================================================================
// Revalidate every hour for individual articles (content rarely changes)
export const revalidate = 3600;
export const dynamic = 'force-static';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await getNewsById(id);
  if (!news) {return {};}
  return generateNewsMetadata(news);
}

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [news, relatedArticles, siteUrl] = await Promise.all([
    getNewsById(id),
    getRelatedArticlesByEntities(id, 6),
    getSiteUrl(),
  ]);

  if (!news) {notFound();}

  const jsonLd = await generateNewsArticleJsonLd(news);

  // Link entities in content
  const processedContent = news.content ? linkEntitiesInContent(news.content, news.entities) : null;

  // Build breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    ...(news.category ? [{ name: news.category, href: `/category/${news.category}` }] : []),
    { name: news.title.slice(0, 50), href: `/news/${id}`, current: true },
  ];
  const breadcrumbJsonLd = await generateBreadcrumbJsonLd(breadcrumbs);

  // Get entities for display
  const entities = news.entities;
  const hasEntities =
    entities &&
    (entities.companies.length > 0 ||
      entities.models.length > 0 ||
      entities.technologies.length > 0 ||
      entities.concepts.length > 0);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      <article className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {news.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{news.sourceName}</span>
            <span>•</span>
            <time dateTime={new Date(news.publishedAt).toISOString()}>
              {format(new Date(news.publishedAt), 'yyyy-MM-dd HH:mm')}
            </time>
            <span>•</span>
            <span>{estimateReadingTime(news.content)}</span>
            <span>•</span>
            <span>Importance: {news.importance}/100</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {news.tags.map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        </header>

        {(news.oneLine || news.summary) && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-black dark:text-zinc-200">
            {news.oneLine ? <p className="font-medium">{news.oneLine}</p> : null}
            {news.summary ? <p className="mt-2">{news.summary}</p> : null}
          </section>
        )}

        {/* Entity Pills */}
        {hasEntities && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mentioned</h2>
            <div className="flex flex-wrap gap-2">
              {entities!.companies.map((c) => {
                const name = entitySlugToName(c);
                return (
                  <Link
                    key={c}
                    href={`/company/${c}`}
                    className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
                  >
                    {name}
                  </Link>
                );
              })}
              {entities!.models.map((m) => {
                const name = entitySlugToName(m);
                return (
                  <Link
                    key={m}
                    href={`/topic/${m}`}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                  >
                    {name}
                  </Link>
                );
              })}
              {entities!.technologies.map((t) => {
                const name = entitySlugToName(t);
                return (
                  <Link
                    key={t}
                    href={`/topic/${t}`}
                    className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300"
                  >
                    {name}
                  </Link>
                );
              })}
              {entities!.concepts.map((c) => {
                const name = entitySlugToName(c);
                return (
                  <Link
                    key={c}
                    href={`/topic/${c}`}
                    className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
                  >
                    {name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {processedContent ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
            <div
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            Full content not stored for this item. Use the original link below.
          </section>
        )}

        <footer className="space-y-4 pt-4">
          <div className="flex items-center justify-center">
            <ShareButtons url={`${siteUrl}/news/${id}`} title={news.title} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <Link href="/latest" className="text-zinc-600 hover:underline dark:text-zinc-300">
              ← Back to latest
            </Link>
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Read original →
            </a>
          </div>
        </footer>
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <aside className="mx-auto max-w-3xl">
          <RelatedArticles articles={relatedArticles} title="Related Articles" />
        </aside>
      )}
    </div>
  );
}
