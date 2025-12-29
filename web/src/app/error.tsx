'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-300">Try again, or go back to the homepage.</p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
