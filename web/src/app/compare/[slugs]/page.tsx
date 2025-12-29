import { ArrowRight, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsGrid } from '@/components/news/NewsGrid';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import {
  getComparisonBySlug,
  listComparisons,
  listTopics,
  getTopicBySlug,
} from '@/lib/db/pseo-queries';
import type { BreadcrumbItem, NewsListItem } from '@/lib/db/types';
import {
  generateComparisonPageJsonLd,
  generateComparisonMetadata,
  generateBreadcrumbJsonLd,
} from '@/lib/pseo-seo';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  params: Promise<{ slugs: string }>;
}

export async function generateStaticParams() {
  try {
    // Generate common comparison pages for popular topics
    const popularComparisons = [
      'chatgpt-vs-claude',
      'gpt-4-vs-gemini',
      'langchain-vs-langgraph',
      'pytorch-vs-tensorflow',
      'openai-vs-anthropic',
    ];
    return popularComparisons.map((slug) => ({ slugs: slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const { slugs } = await params;
  const comparison = await getComparisonBySlug(slugs);

  if (!comparison) {
    return {
      title: 'Comparison Not Found',
    };
  }

  const metadata = await generateComparisonMetadata(comparison);
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

async function getTopicNews(topicSlugs: string[]): Promise<NewsListItem[]> {
  const { getDb } = await import('@/lib/d1');
  const { mapNewsRow, toListItem } = await import('@/lib/db/row');
  const db = await getDb();

  const placeholders = topicSlugs.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `
      SELECT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
      FROM topic_news tn
      JOIN news n ON n.id = tn.news_id
      JOIN sources s ON s.id = n.source_id
      JOIN topic_pages tp ON tp.id = tn.topic_id
      WHERE tp.slug IN (${placeholders})
        AND n.importance >= 50
      ORDER BY n.published_at DESC
      LIMIT 8
      `
    )
    .bind(...topicSlugs)
    .all();

  return ((rows.results ?? []) as Record<string, unknown>[]).map(mapNewsRow).map(toListItem);
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { slugs } = await params;
  const comparison = await getComparisonBySlug(slugs);

  // Try to parse entities from slug if no comparison page exists
  const entities = slugs.split('-vs-');
  const entityA = entities[0] || '';
  const entityB = entities[1] || '';

  // Get topic data for both entities
  const topicA = await getTopicBySlug(entityA);
  const topicB = await getTopicBySlug(entityB);

  if (!comparison && !topicA && !topicB) {
    notFound();
  }

  // Get related news
  const topicSlugs = [entityA, entityB].filter(Boolean);
  const news = await getTopicNews(topicSlugs);

  // Get related comparisons
  const { items: relatedComparisons } = await listComparisons({ limit: 6 });
  const filteredRelated = relatedComparisons.filter((c) => c.slug !== slugs).slice(0, 4);

  // Get all topics for suggestions
  const { items: allTopics } = await listTopics({ limit: 20, minNewsCount: 5 });

  // Breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Comparisons', href: '/compare' },
    {
      name: comparison?.title || `${entityA} vs ${entityB}`,
      href: `/compare/${slugs}`,
      current: true,
    },
  ];

  // Format entity names for display
  const formatName = (slug: string) => {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const displayNameA = topicA?.name || formatName(entityA);
  const displayNameB = topicB?.name || formatName(entityB);

  const jsonLd = comparison
    ? await generateComparisonPageJsonLd(comparison)
    : JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${displayNameA} vs ${displayNameB}`,
      });
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
          <Scale className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Comparison</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {comparison?.title || `${displayNameA} vs ${displayNameB}`}
        </h1>

        {comparison?.description && (
          <p className="max-w-3xl text-lg text-zinc-600 dark:text-zinc-300">
            {comparison.description}
          </p>
        )}
      </header>

      {/* Comparison Content */}
      {comparison?.contentHtml ? (
        <section
          className="prose prose-zinc dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: comparison.contentHtml }}
        />
      ) : (
        <section className="space-y-6">
          {/* Entity Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Entity A */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {displayNameA.charAt(0)}
                </div>
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {displayNameA}
                </h2>
              </div>
              {topicA?.description && (
                <p className="text-zinc-600 dark:text-zinc-400">{topicA.description}</p>
              )}
              {topicA && (
                <div className="mt-4">
                  <Link
                    href={`/topic/${topicA.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View all articles <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* Entity B */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  {displayNameB.charAt(0)}
                </div>
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {displayNameB}
                </h2>
              </div>
              {topicB?.description && (
                <p className="text-zinc-600 dark:text-zinc-400">{topicB.description}</p>
              )}
              {topicB && (
                <div className="mt-4">
                  <Link
                    href={`/topic/${topicB.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    View all articles <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Quick Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Feature
                  </th>
                  <th className="py-3 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
                    {displayNameA}
                  </th>
                  <th className="py-3 text-center text-sm font-medium text-purple-700 dark:text-purple-300">
                    {displayNameB}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    Articles Available
                  </td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicA?.newsCount ?? 0}
                  </td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicB?.newsCount ?? 0}
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 text-sm text-zinc-700 dark:text-zinc-300">Type</td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicA?.type ?? '-'}
                  </td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicB?.type ?? '-'}
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 text-sm text-zinc-700 dark:text-zinc-300">Last Updated</td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicA?.lastNewsUpdatedAt
                      ? new Date(topicA.lastNewsUpdatedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="py-3 text-center text-sm text-zinc-900 dark:text-zinc-100">
                    {topicB?.lastNewsUpdatedAt
                      ? new Date(topicB.lastNewsUpdatedAt).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Related News */}
      {news.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Latest News about {displayNameA} and {displayNameB}
          </h2>
          <NewsGrid items={news} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No articles found for comparison. Check back soon!
          </p>
        </section>
      )}

      {/* Related Comparisons */}
      {filteredRelated.length > 0 && (
        <aside className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            More Comparisons
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredRelated.map((c) => (
              <Link
                key={c.id}
                href={`/compare/${c.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <Scale className="h-5 w-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                <span className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {c.title}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      {/* Create Your Own Comparison */}
      <section className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Compare Any Topics
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Select two topics to see their side-by-side comparison:
        </p>
        <div className="flex flex-wrap gap-2">
          {allTopics.slice(0, 12).map((topic) => (
            <Link
              key={topic.id}
              href={`/compare/${entityA}-vs-${topic.slug}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {topic.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
