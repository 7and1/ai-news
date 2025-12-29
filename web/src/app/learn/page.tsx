import { BookOpen, Clock, GraduationCap, Target } from 'lucide-react';
import Link from 'next/link';

import { listLearningPaths, getRoleSlugs } from '@/lib/db/pseo-queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Learning Paths - Master AI Step by Step',
  description:
    'Structured learning paths to help you master AI, machine learning, and related technologies.',
};

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

export default async function LearnPage() {
  const { items: paths } = await listLearningPaths({ limit: 50 });

  const beginnerPaths = paths.filter((p) => p.difficulty === 'beginner');
  const intermediatePaths = paths.filter((p) => p.difficulty === 'intermediate');
  const advancedPaths = paths.filter((p) => p.difficulty === 'advanced');

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Learning Hub</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Structured Learning Paths
        </h1>

        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Master AI and machine learning with our curated learning paths. Each path is designed to
          take you from beginner to advanced, with hands-on projects and real-world examples.
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950">
          <GraduationCap className="mx-auto h-6 w-6 text-green-600 dark:text-green-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {beginnerPaths.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Beginner Paths</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-900 dark:bg-yellow-950">
          <Target className="mx-auto h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {intermediatePaths.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Intermediate Paths</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950">
          <Clock className="mx-auto h-6 w-6 text-red-600 dark:text-red-400" />
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {advancedPaths.length}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Advanced Paths</p>
        </div>
      </section>

      {/* Beginner Paths */}
      {beginnerPaths.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Beginner Friendly
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {beginnerPaths.map((path) => (
              <Link
                key={path.id}
                href={`/learn/${path.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-green-300 hover:shadow-md dark:border-zinc-800 dark:bg-black dark:hover:border-green-700"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor('beginner')}`}
                  >
                    Beginner
                  </span>
                  {path.estimatedHours && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {path.estimatedHours}h
                    </span>
                  )}
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {path.title}
                </h3>
                {path.description && (
                  <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {path.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Intermediate Paths */}
      {intermediatePaths.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Intermediate Level
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {intermediatePaths.map((path) => (
              <Link
                key={path.id}
                href={`/learn/${path.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-yellow-300 hover:shadow-md dark:border-zinc-800 dark:bg-black dark:hover:border-yellow-700"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor('intermediate')}`}
                  >
                    Intermediate
                  </span>
                  {path.estimatedHours && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {path.estimatedHours}h
                    </span>
                  )}
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {path.title}
                </h3>
                {path.description && (
                  <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {path.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Advanced Paths */}
      {advancedPaths.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Advanced Topics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {advancedPaths.map((path) => (
              <Link
                key={path.id}
                href={`/learn/${path.slug}`}
                className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-red-300 hover:shadow-md dark:border-zinc-800 dark:bg-black dark:hover:border-red-700"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor('advanced')}`}
                  >
                    Advanced
                  </span>
                  {path.estimatedHours && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {path.estimatedHours}h
                    </span>
                  )}
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
                  {path.title}
                </h3>
                {path.description && (
                  <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {path.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* No paths state */}
      {paths.length === 0 && (
        <section className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <GraduationCap className="mx-auto h-12 w-12 text-zinc-400" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Learning Paths Coming Soon
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            We are curating the best learning paths for you. Check back soon!
          </p>
        </section>
      )}

      {/* Role-based link */}
      <section className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Learn for Your Role
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Browse role-specific learning content and resources.
        </p>
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
