import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsGrid } from '@/components/news/NewsGrid';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import { getTopicWithNews, getTopicChildren, listTopics } from '@/lib/db/pseo-queries';
import { getRoleSlugs } from '@/lib/db/pseo-queries';
import type { BreadcrumbItem } from '@/lib/db/types';
import {
  generateTopicPageJsonLd,
  generateTopicMetadata,
  generateBreadcrumbJsonLd,
} from '@/lib/pseo-seo';

export const dynamic = 'force-dynamic';

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const { items } = await listTopics({ limit: 100 });
    return items.slice(0, 50).map((topic) => ({
      slug: topic.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicWithNews(slug);

  if (!topic) {
    return {
      title: 'Topic Not Found',
    };
  }

  const metadata = await generateTopicMetadata(topic);
  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: metadata.canonical,
    },
    openGraph: metadata.openGraph,
    twitter: {
      card: 'summary_large_image',
      title: metadata.title,
      description: metadata.description,
      images: metadata.openGraph.images.map((img) => img.url),
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const topic = await getTopicWithNews(slug, 30);

  if (!topic) {
    notFound();
  }

  // Get child topics
  const children = await getTopicChildren(topic.id);

  // Get related topics (same type)
  const { items: relatedTopics } = await listTopics({
    type: topic.type,
    limit: 8,
    minNewsCount: 1,
  });
  const filteredRelated = relatedTopics.filter((t) => t.id !== topic.id).slice(0, 6);

  // Breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Topics', href: '/topics' },
    { name: topic.name, href: `/topic/${topic.slug}`, current: true },
  ];

  const jsonLd = await generateTopicPageJsonLd(topic);
  const breadcrumbJsonLd = await generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {topic.type}
          </span>
          {topic.newsCount > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {topic.newsCount} article{topic.newsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {topic.name}
        </h1>

        {topic.description && (
          <p className="max-w-3xl text-lg text-zinc-600 dark:text-zinc-300">{topic.description}</p>
        )}

        {topic.contentHtml && (
          <div
            className="prose prose-zinc dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: topic.contentHtml }}
          />
        )}
      </header>

      {/* Child Topics */}
      {children.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Subtopics</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/topic/${child.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {child.name}
                </h3>
                {child.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {child.description.slice(0, 100)}
                    {child.description.length > 100 ? '...' : ''}
                  </p>
                )}
                <span className="mt-2 text-xs text-zinc-500">{child.newsCount} articles</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* News */}
      {topic.recentNews && topic.recentNews.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Latest News</h2>
          </div>
          <NewsGrid items={topic.recentNews} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No articles found for this topic yet. Check back soon!
          </p>
        </section>
      )}

      {/* Related Topics */}
      {filteredRelated.length > 0 && (
        <aside className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Related {topic.type}s
          </h2>
          <div className="flex flex-wrap gap-2">
            {filteredRelated.map((t) => (
              <Link
                key={t.id}
                href={`/topic/${t.slug}`}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </aside>
      )}

      {/* Role-based links */}
      <section className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Explore by Role
        </h2>
        <div className="flex flex-wrap gap-2">
          {getRoleSlugs().map((role) => (
            <Link
              key={role}
              href={`/for/${role}`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {role
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
