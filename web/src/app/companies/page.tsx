import { Building2, MapPin, Calendar } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { listCompanies, listCompanyIndustries } from '@/lib/db/pseo-queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Companies - Company Profiles and Latest News',
  description:
    'Explore AI company profiles, track news from leading AI companies, and discover industry trends.',
};

export default async function CompaniesPage() {
  const { items: companies, total } = await listCompanies({
    limit: 50,
    minNewsCount: 0,
  });
  const industries = await listCompanyIndustries();

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Companies</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          AI Company Profiles
        </h1>

        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Track the latest news and updates from leading AI companies. Explore company profiles,
          founding teams, and industry insights.
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Building2 className="mx-auto h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{total}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Companies Tracked</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Calendar className="mx-auto h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {companies.filter((c) => c.foundedYear && c.foundedYear >= 2020).length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Founded Since 2020</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <MapPin className="mx-auto h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {industries.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Industries</p>
        </div>
      </section>

      {/* Industry Filter */}
      {industries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Browse by Industry
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/companies"
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              All Industries ({total})
            </Link>
            {industries.map((ind) => (
              <Link
                key={ind.industry}
                href={`/companies?industry=${encodeURIComponent(ind.industry)}`}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {ind.industry} ({ind.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Company List */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">All Companies</h2>
        {companies.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/company/${company.slug}`}
                className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt={`${company.name} logo`}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded border border-zinc-200 p-1 dark:border-zinc-800"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {company.name}
                  </h3>
                  {company.industry && (
                    <p className="mt-0.5 text-xs text-zinc-500">{company.industry}</p>
                  )}
                  {company.headquarters && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="h-3 w-3" />
                      {company.headquarters}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    {company.newsCount} article
                    {company.newsCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <Building2 className="mx-auto h-12 w-12 text-zinc-400" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              No Companies Found
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Company profiles will be added as we ingest more news.
            </p>
          </div>
        )}
      </section>

      {/* Related Links */}
      <section className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Explore More</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/topics"
            className="rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Browse Topics</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Explore AI models, technologies, and concepts
            </p>
          </Link>
          <Link
            href="/compare"
            className="rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Comparisons</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Compare companies, tools, and models
            </p>
          </Link>
          <Link
            href="/learn"
            className="rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Learning Paths</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Structured courses to master AI
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
