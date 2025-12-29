import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getSiteUrl } from '@/lib/d1';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}

export const dynamic = 'force-dynamic';

function UnsubscribeContent({ token }: { token: string }) {
  return (
    <div className="mx-auto min-h-[60vh] w-full max-w-lg px-4 py-16">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg
            className="h-8 w-8 text-zinc-600 dark:text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Unsubscribe from Newsletter
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;re sorry to see you go. You can unsubscribe from our newsletter using the button
          below.
        </p>

        <form
          action={async () => {
            'use server';
            const siteUrl = await getSiteUrl();
            const response = await fetch(
              `${siteUrl}/api/newsletter/unsubscribe`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
              }
            );

            const data = await response.json();

            if (data.success) {
              redirect(`/newsletter/unsubscribe/${token}?confirmed=true`);
            }
          }}
          className="mt-8"
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Yes, Unsubscribe Me
          </button>
        </form>

        <div className="mt-6">
          <Link
            href={`/newsletter/preferences/${token}`}
            className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Or update my preferences instead
          </Link>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function UnconfirmedPage() {
  return (
    <div className="mx-auto min-h-[60vh] w-full max-w-lg px-4 py-16">
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm dark:border-green-800 dark:bg-green-900/20">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
          <svg
            className="h-8 w-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-green-900 dark:text-green-400">
          You&apos;ve Been Unsubscribed
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-sm text-green-700 dark:text-green-300">
          You have been successfully unsubscribed from our newsletter. We&apos;re sorry to see you
          go!
        </p>

        <p className="mt-4 text-sm text-green-600 dark:text-green-400">
          If you change your mind, you can always resubscribe from our homepage.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-block rounded-lg border border-green-300 bg-white px-6 py-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:border-green-700 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function UnsubscribePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { confirmed } = await searchParams;

  if (confirmed === 'true') {
    return <UnconfirmedPage />;
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <UnsubscribeContent token={token} />
    </Suspense>
  );
}
