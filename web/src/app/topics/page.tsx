import { Search, TrendingUp, Building2, Lightbulb } from 'lucide-react';
import Link from 'next/link';

import { listTopicsByType } from '@/lib/db/pseo-queries';
import { generateWebSiteJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Topics Hub - Explore by Subject',
  description:
    'Browse AI news and resources by topic. Find articles on machine learning, deep learning, NLP, computer vision, and more.',
};

export default async function TopicsPage() {
  const topicsByType = await listTopicsByType();
  const jsonLd = await generateWebSiteJsonLd();

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Explore by Topic
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Browse AI news, tutorials, and resources organized by topic. From machine learning
          fundamentals to cutting-edge models.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Search className="h-4 w-4" />
            Search Topics
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <TrendingUp className="mx-auto h-6 w-6 text-blue-600 dark:text-blue-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {topicsByType.model.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">AI Models</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Lightbulb className="mx-auto h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {topicsByType.technology.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Technologies</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Building2 className="mx-auto h-6 w-6 text-green-600 dark:text-green-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {topicsByType.company.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Companies</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Search className="mx-auto h-6 w-6 text-purple-600 dark:text-purple-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {topicsByType.concept.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Concepts</p>
        </div>
      </section>

      {/* AI Models */}
      {topicsByType.model.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            AI Models
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topicsByType.model.slice(0, 12).map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-blue-700"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {topic.name}
                  </h3>
                  <span className="text-xs text-zinc-500">{topic.newsCount} articles</span>
                </div>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {topic.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
          {topicsByType.model.length > 12 && (
            <Link
              href="/topic?type=model"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all {topicsByType.model.length} models &rarr;
            </Link>
          )}
        </section>
      )}

      {/* Technologies */}
      {topicsByType.technology.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Technologies & Frameworks
          </h2>
          <div className="flex flex-wrap gap-2">
            {topicsByType.technology.slice(0, 20).map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {topic.name}
              </Link>
            ))}
          </div>
          {topicsByType.technology.length > 20 && (
            <Link
              href="/topic?type=technology"
              className="inline-block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all {topicsByType.technology.length} technologies &rarr;
            </Link>
          )}
        </section>
      )}

      {/* Companies */}
      {topicsByType.company.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            AI Companies
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topicsByType.company.slice(0, 8).map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-green-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-green-700"
              >
                <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {topic.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">{topic.newsCount} articles</p>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/companies"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View company profiles &rarr;
            </Link>
            {topicsByType.company.length > 8 && (
              <Link
                href="/topic?type=company"
                className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                All {topicsByType.company.length} company topics &rarr;
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Concepts */}
      {topicsByType.concept.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            <Search className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Concepts & Research Topics
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topicsByType.concept.slice(0, 9).map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-purple-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-purple-700"
              >
                <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {topic.name}
                </h3>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {topic.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
          {topicsByType.concept.length > 9 && (
            <Link
              href="/topic?type=concept"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all {topicsByType.concept.length} concepts &rarr;
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
