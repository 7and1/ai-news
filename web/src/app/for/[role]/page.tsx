import { BookOpen, Users, Target, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsGrid } from '@/components/news/NewsGrid';
import { Breadcrumb } from '@/components/seo/Breadcrumb';
import { getRolePageData, isValidRole, getRoleSlugs } from '@/lib/db/pseo-queries';
import type { BreadcrumbItem } from '@/lib/db/types';
import {
  generateRolePageJsonLd,
  generateRoleMetadata,
  generateBreadcrumbJsonLd,
} from '@/lib/pseo-seo';

export const dynamic = 'force-dynamic';

interface RolePageProps {
  params: Promise<{ role: string }>;
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  developers: Target,
  'product-managers': TrendingUp,
  designers: BookOpen,
  'data-scientists': TrendingUp,
  executives: Users,
  entrepreneurs: Target,
  researchers: BookOpen,
  students: BookOpen,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  developers: 'AI tools, frameworks, and best practices for software development.',
  'product-managers': 'How AI is transforming product development and user experience.',
  designers: 'AI tools for design, prototyping, and creative workflows.',
  'data-scientists': 'ML models, research papers, and advanced AI techniques.',
  executives: 'Strategic insights on AI adoption, industry trends, and business implications.',
  entrepreneurs: 'Build and scale AI-powered startups with the latest insights.',
  researchers: 'Latest research papers, breakthroughs, and academic advancements.',
  students: 'Structured learning paths and resources to master AI.',
};

export async function generateStaticParams() {
  return getRoleSlugs().map((role) => ({
    role,
  }));
}

export async function generateMetadata({ params }: RolePageProps): Promise<Metadata> {
  const { role } = await params;

  if (!isValidRole(role)) {
    return {
      title: 'Role Not Found',
    };
  }

  const title = role
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const description = ROLE_DESCRIPTIONS[role] ?? `AI news and resources for ${title}`;

  const metadata = await generateRoleMetadata(role, title, description);
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

export default async function RolePage({ params }: RolePageProps) {
  const { role } = await params;

  if (!isValidRole(role)) {
    notFound();
  }

  const data = await getRolePageData(role);
  const Icon = ROLE_ICONS[role] ?? Users;

  // Breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'For Roles', href: '/for' },
    { name: data.title, href: `/for/${role}`, current: true },
  ];

  const jsonLd = await generateRolePageJsonLd(role, data.title, data.description);
  const breadcrumbJsonLd = await generateBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <Icon className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {data.title}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">{data.description}</p>
          </div>
        </div>
      </header>

      {/* Relevant Topics */}
      {data.topics.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Key Topics for You
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
              >
                <span className="mb-1 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {topic.type}
                </span>
                <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {topic.name}
                </h3>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {topic.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-zinc-500">{topic.newsCount} articles</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Relevant News */}
      {data.news.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Latest News for {data.title.split(' ').pop()}
          </h2>
          <NewsGrid items={data.news.slice(0, 12)} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No articles found yet. Check back soon!
          </p>
        </section>
      )}

      {/* Other Roles */}
      <section className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Explore Other Roles
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {getRoleSlugs()
            .filter((r) => r !== role)
            .map((otherRole) => {
              const OtherIcon = ROLE_ICONS[otherRole] ?? Users;
              const title = otherRole
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
              return (
                <Link
                  key={otherRole}
                  href={`/for/${otherRole}`}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
                >
                  <OtherIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {title}
                  </span>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
