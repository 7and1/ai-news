import { BookOpen, Clock, GraduationCap, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsGrid } from '@/components/news/NewsGrid';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import { getLearningPathBySlug, listLearningPaths, getTopicBySlug } from '@/lib/db/pseo-queries';
import type { BreadcrumbItem, TopicPage, NewsListItem } from '@/lib/db/types';
import {
  generateLearningPathJsonLd,
  generateLearningPathMetadata,
  generateBreadcrumbJsonLd,
} from '@/lib/pseo-seo';

export const dynamic = 'force-dynamic';

interface LearnPageProps {
  params: Promise<{ topic: string }>;
}

export async function generateStaticParams() {
  try {
    const { items } = await listLearningPaths({ limit: 50 });
    return items.map((path) => ({
      topic: path.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: LearnPageProps): Promise<Metadata> {
  const { topic } = await params;
  const path = await getLearningPathBySlug(topic);

  if (!path) {
    return {
      title: 'Learning Path Not Found',
    };
  }

  const metadata = await generateLearningPathMetadata(path);
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

function getDifficultyColor(difficulty: string | null): string {
  switch (difficulty) {
    case 'beginner':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'advanced':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200';
  }
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
      LIMIT 12
      `
    )
    .bind(...topicSlugs)
    .all();

  return ((rows.results ?? []) as Record<string, unknown>[]).map(mapNewsRow).map(toListItem);
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { topic } = await params;
  const path = await getLearningPathBySlug(topic);

  if (!path) {
    notFound();
  }

  // Get topics for this path
  const topics: TopicPage[] = [];
  for (const topicId of path.topics.slice(0, 10)) {
    const topic = await getTopicBySlug(topicId);
    if (topic) {
      topics.push(topic);
    }
  }

  // Get related news
  const news = await getTopicNews(path.topics);

  // Get related paths
  const { items: relatedPaths } = await listLearningPaths({
    difficulty: path.difficulty ?? undefined,
    limit: 5,
  });
  const filteredRelated = relatedPaths.filter((p) => p.id !== path.id).slice(0, 4);

  // Breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Learning Paths', href: '/learn' },
    { name: path.title, href: `/learn/${path.slug}`, current: true },
  ];

  const jsonLd = await generateLearningPathJsonLd(path);
  const breadcrumbJsonLd = await generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {path.difficulty && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getDifficultyColor(path.difficulty)}`}
            >
              {path.difficulty.charAt(0).toUpperCase() + path.difficulty.slice(1)}
            </span>
          )}
          {path.estimatedHours && (
            <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Clock className="h-4 w-4" />
              {path.estimatedHours} hours
            </span>
          )}
          <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <GraduationCap className="h-4 w-4" />
            {path.enrollmentCount} learners
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {path.title}
        </h1>

        {path.description && (
          <p className="max-w-3xl text-lg text-zinc-600 dark:text-zinc-300">{path.description}</p>
        )}

        {/* Learning progress indicator */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Your Progress
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {topics.length > 0 ? '0' : '0'}/{topics.length} topics completed
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full w-0 rounded-full bg-blue-600 dark:bg-blue-500" />
          </div>
        </div>
      </header>

      {/* Content HTML if exists */}
      {path.contentHtml && (
        <section className="prose prose-zinc dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: path.contentHtml }} />
        </section>
      )}

      {/* Learning Path - Topics */}
      {topics.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Learning Path Curriculum
          </h2>
          <div className="space-y-3">
            {topics.map((topic, index) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="group flex items-start gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {topic.name}
                  </h3>
                  {topic.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {topic.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <BookOpen className="h-3 w-3" />
                    <span>{topic.newsCount} articles</span>
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-zinc-300 group-hover:text-green-600 dark:text-zinc-700" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Prerequisites */}
      {path.prerequisites && path.prerequisites.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Prerequisites
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Before starting this path, you should have familiarity with:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {path.prerequisites.map((prereq, index) => (
              <span
                key={index}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-300"
              >
                {prereq}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Related News */}
      {news.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Practice with Recent Articles
          </h2>
          <NewsGrid items={news.slice(0, 8)} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Start your learning journey by exploring the topics above!
          </p>
        </section>
      )}

      {/* Related Paths */}
      {filteredRelated.length > 0 && (
        <aside className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Continue Your Learning
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredRelated.map((p) => (
              <Link
                key={p.id}
                href={`/learn/${p.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {p.title}
                  </h3>
                  {p.difficulty && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${getDifficultyColor(p.difficulty)}`}
                    >
                      {p.difficulty}
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {p.description}
                  </p>
                )}
                {p.estimatedHours && (
                  <p className="mt-2 text-xs text-zinc-500">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {p.estimatedHours} hours
                  </p>
                )}
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
