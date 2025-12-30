import { ArrowRight, Scale } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { listComparisons, listTopics, listCompanies } from '@/lib/db/pseo-queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Comparisons - Compare Tools, Models, and Technologies',
  description:
    'Side-by-side comparisons of AI models, tools, frameworks, and companies. Make informed decisions with our detailed comparisons.',
};

export default async function ComparePage() {
  const { items: comparisons } = await listComparisons({ limit: 20 });
  const { items: topics } = await listTopics({ limit: 30, minNewsCount: 5 });
  const { items: companies } = await listCompanies({
    limit: 20,
    minNewsCount: 5,
  });

  // Generate common comparison suggestions
  const popularModels = topics.filter((t) => t.type === 'model').slice(0, 6);
  const popularCompanies = companies.slice(0, 6);

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Comparisons</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Compare AI Tools & Models
        </h1>

        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Make informed decisions with our side-by-side comparisons. Compare AI models, frameworks,
          companies, and more.
        </p>
      </header>

      {/* Popular Comparisons */}
      {comparisons.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Popular Comparisons
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comparisons.map((comparison) => (
              <Link
                key={comparison.id}
                href={`/compare/${comparison.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <Scale className="h-5 w-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                <div className="flex-1">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {comparison.title}
                  </h3>
                  {comparison.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {comparison.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Compare AI Models */}
      {popularModels.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Compare AI Models
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Select two models to compare:</p>
          <div className="flex flex-wrap gap-2">
            {popularModels.map((model) => (
              <Link
                key={model.id}
                href={`/topic/${model.slug}`}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                {model.name}
              </Link>
            ))}
          </div>

          {/* Suggested comparisons */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Suggested Comparisons
            </p>
            <div className="flex flex-wrap gap-2">
              {popularModels.slice(0, 4).map((model, i) => {
                const nextModel = popularModels[i + 1];
                if (!nextModel) {
                  return null;
                }
                const slug = `${model.slug}-vs-${nextModel.slug}`;
                return (
                  <Link
                    key={slug}
                    href={`/compare/${slug}`}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {model.name} vs {nextModel.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Compare Companies */}
      {popularCompanies.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Compare Companies
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popularCompanies.map((company) => (
              <Link
                key={company.id}
                href={`/company/${company.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-green-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-green-700"
              >
                {company.logoUrl && (
                  <Image
                    src={company.logoUrl}
                    alt={`${company.name} logo`}
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 rounded border border-zinc-200 p-0.5 dark:border-zinc-800"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {company.name}
                  </h3>
                  <p className="text-xs text-zinc-500">{company.newsCount} articles</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Suggested company comparisons */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Suggested Comparisons
            </p>
            <div className="flex flex-wrap gap-2">
              {popularCompanies.slice(0, 4).map((company, i) => {
                const nextCompany = popularCompanies[i + 1];
                if (!nextCompany) {
                  return null;
                }
                const slug = `${company.slug}-vs-${nextCompany.slug}`;
                return (
                  <Link
                    key={slug}
                    href={`/compare/${slug}`}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {company.name} vs {nextCompany.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Build Your Own Comparison */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Create Your Own Comparison
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Compare any two topics by modifying the URL:{' '}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
            /compare/[topic-a]-vs-[topic-b]
          </code>
        </p>
        <div className="flex flex-wrap gap-2">
          {topics.length > 0 &&
            topics.slice(0, 10).map((topic) => (
              <Link
                key={topic.id}
                href={`/compare/${topics[0]!.slug}-vs-${topic.slug}`}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:underline dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {topics[0]!.name} vs {topic.name}
              </Link>
            ))}
        </div>
      </section>

      {/* No comparisons state */}
      {comparisons.length === 0 && topics.length === 0 && (
        <section className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <Scale className="mx-auto h-12 w-12 text-zinc-400" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Comparisons Coming Soon
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            We are building detailed comparisons. Check back soon!
          </p>
        </section>
      )}
    </div>
  );
}
