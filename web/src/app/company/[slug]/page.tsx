import { ExternalLink, Calendar, MapPin, Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsGrid } from '@/components/news/NewsGrid';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import { getCompanyWithNews, listCompanies } from '@/lib/db/pseo-queries';
import type { BreadcrumbItem } from '@/lib/db/types';
import {
  generateCompanyPageJsonLd,
  generateCompanyMetadata,
  generateBreadcrumbJsonLd,
} from '@/lib/pseo-seo';

export const dynamic = 'force-dynamic';

interface CompanyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const { items } = await listCompanies({ limit: 100, minNewsCount: 1 });
    return items.slice(0, 50).map((company) => ({
      slug: company.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyWithNews(slug);

  if (!company) {
    return {
      title: 'Company Not Found',
    };
  }

  const metadata = await generateCompanyMetadata(company);
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

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { slug } = await params;
  const company = await getCompanyWithNews(slug, 30);

  if (!company) {
    notFound();
  }

  // Get related companies (same industry)
  const { items: relatedCompanies } = await listCompanies({
    industry: company.industry ?? undefined,
    limit: 7,
    minNewsCount: 1,
  });
  const filteredRelated = relatedCompanies.filter((c) => c.id !== company.id).slice(0, 6);

  // Breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Companies', href: '/companies' },
    { name: company.name, href: `/company/${company.slug}`, current: true },
  ];

  const jsonLd = await generateCompanyPageJsonLd(company);
  const breadcrumbJsonLd = await generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      {/* Company Header */}
      <header className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {company.logoUrl && (
              <Image
                src={company.logoUrl}
                alt={`${company.name} logo`}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800"
              />
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {company.name}
              </h1>
              {company.legalName && company.legalName !== company.name && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Legal name: {company.legalName}
                </p>
              )}
            </div>
          </div>

          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </a>
          )}
        </div>

        {/* Company Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          {company.industry && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span>{company.industry}</span>
            </div>
          )}
          {company.headquarters && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{company.headquarters}</span>
            </div>
          )}
          {company.foundedYear && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Founded {company.foundedYear}</span>
            </div>
          )}
          {company.newsCount > 0 && (
            <span className="text-zinc-600 dark:text-zinc-400">
              {company.newsCount} article{company.newsCount !== 1 ? 's' : ''} in our database
            </span>
          )}
        </div>

        {/* Description */}
        {company.description && (
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p>{company.description}</p>
          </div>
        )}

        {/* Social Links */}
        <div className="flex flex-wrap gap-3">
          {company.twitterHandle && (
            <a
              href={`https://twitter.com/${company.twitterHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              @{company.twitterHandle}
            </a>
          )}
          {company.linkedinUrl && (
            <a
              href={company.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              LinkedIn
            </a>
          )}
        </div>
      </header>

      {/* Content HTML if exists */}
      {company.contentHtml && (
        <section className="prose prose-zinc dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: company.contentHtml }} />
        </section>
      )}

      {/* News */}
      {company.recentNews && company.recentNews.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Latest News about {company.name}
          </h2>
          <NewsGrid items={company.recentNews} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No articles found about this company yet. Check back soon!
          </p>
        </section>
      )}

      {/* Related Companies */}
      {filteredRelated.length > 0 && (
        <aside className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Related Companies
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRelated.map((c) => (
              <Link
                key={c.id}
                href={`/company/${c.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  {c.logoUrl && (
                    <Image
                      src={c.logoUrl}
                      alt={`${c.name} logo`}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded border border-zinc-200 p-1 dark:border-zinc-800"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                      {c.name}
                    </h3>
                    {c.industry && <p className="text-xs text-zinc-500">{c.industry}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
