import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getNewsletterEdition } from '@/lib/db/newsletter-queries';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function NewsletterArchivePage({ params }: PageProps) {
  const { id } = await params;

  const edition = await getNewsletterEdition(id);

  if (!edition || edition.status !== 'sent') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/newsletter"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to newsletters
      </Link>

      <article className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            {edition.title}
          </h1>
          {edition.previewText && (
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{edition.previewText}</p>
          )}
          <div className="mt-4 flex items-center gap-4 text-sm text-zinc-500">
            {edition.sentAt && <span>{new Date(edition.sentAt).toLocaleDateString()}</span>}
            <span>•</span>
            <span>{edition.articleIds.length} articles</span>
            {edition.recipientCount > 0 && (
              <>
                <span>•</span>
                <span>{edition.recipientCount} subscribers</span>
              </>
            )}
          </div>
        </header>

        <div
          className="prose prose-zinc dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: edition.contentHtml }}
        />

        <footer className="mt-12 border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Enjoyed this newsletter?</p>
          <Link
            href="/newsletter"
            className="mt-2 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Subscribe for weekly updates
          </Link>
        </footer>
      </article>
    </div>
  );
}
