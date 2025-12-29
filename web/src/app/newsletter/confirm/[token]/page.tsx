import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSiteUrl } from '@/lib/d1';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ConfirmPage({ params }: PageProps) {
  const { token } = await params;
  const siteUrl = await getSiteUrl();

  // Confirm subscription via API
  const response = await fetch(
    `${siteUrl}/api/newsletter/confirm/${token}`,
    {
      method: 'POST',
      cache: 'no-store',
    }
  );

  const data = await response.json();

  if (data.success) {
    // Redirect to preferences page on success
    redirect(`/newsletter/preferences/${token}?confirmed=true`);
  }

  // Handle errors
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-red-900 dark:text-red-400">
          Confirmation Failed
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {data.error || 'Invalid or expired confirmation link'}
        </p>
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          The link may have expired or already been used. Please try subscribing again.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
