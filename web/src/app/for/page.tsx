import {
  Users,
  Target,
  BookOpen,
  TrendingUp,
  Briefcase,
  Palette,
  GraduationCap,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';

import { getRoleSlugs } from '@/lib/db/pseo-queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI for Your Role - Personalized Content',
  description: 'Find AI news, resources, and learning paths tailored to your professional role.',
};

const ROLE_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  developers: {
    title: 'AI for Developers',
    description: 'Tools, frameworks, and best practices for software development with AI.',
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
  },
  'product-managers': {
    title: 'AI for Product Managers',
    description: 'How AI is transforming product development and user experience.',
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
  },
  designers: {
    title: 'AI for Designers',
    description: 'AI tools for design, prototyping, and creative workflows.',
    icon: Palette,
    color: 'text-purple-600 dark:text-purple-400',
  },
  'data-scientists': {
    title: 'AI for Data Scientists',
    description: 'ML models, research papers, and advanced AI techniques.',
    icon: GraduationCap,
    color: 'text-orange-600 dark:text-orange-400',
  },
  executives: {
    title: 'AI for Executives',
    description: 'Strategic insights on AI adoption, industry trends, and business implications.',
    icon: Briefcase,
    color: 'text-red-600 dark:text-red-400',
  },
  entrepreneurs: {
    title: 'AI for Entrepreneurs',
    description: 'Build and scale AI-powered startups with the latest insights.',
    icon: Rocket,
    color: 'text-pink-600 dark:text-pink-400',
  },
  researchers: {
    title: 'AI Research',
    description: 'Latest research papers, breakthroughs, and academic advancements.',
    icon: BookOpen,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  students: {
    title: 'AI Learning for Students',
    description: 'Structured learning paths and resources to master AI.',
    icon: GraduationCap,
    color: 'text-teal-600 dark:text-teal-400',
  },
};

export default async function ForPage() {
  const roles = getRoleSlugs();

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Role-Based Content
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Find AI Content for Your Role
        </h1>

        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Discover curated AI news, learning paths, and resources tailored specifically to your
          professional role and interests.
        </p>
      </header>

      {/* Role Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => {
          const config = ROLE_CONFIG[role];
          if (!config) {
            return null;
          }
          const Icon = config.icon;

          return (
            <Link
              key={role}
              href={`/for/${role}`}
              className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              <h2 className="mb-2 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
                {config.title}
              </h2>
              <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {config.description}
              </p>
            </Link>
          );
        })}
      </section>

      {/* Feature Section */}
      <section className="rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 p-8 dark:from-zinc-900 dark:to-zinc-950">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              Personalized AI Learning
            </h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Whether you are a developer looking to integrate AI into your applications, a product
              manager exploring AI features, or an executive making strategic decisions about AI
              adoption, we have curated content specifically for you.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Curated news and articles for your role',
                'Recommended learning paths and tutorials',
                'Industry-specific case studies and examples',
                'Tools and frameworks tailored to your needs',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/learn"
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Browse Learning Paths
                </span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link
                href="/topics"
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Explore Topics
                </span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link
                href="/compare"
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Compare Tools & Models
                </span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
