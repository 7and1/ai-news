import { ManagePreferences } from '@/components/newsletter/ManagePreferences';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PreferencesPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { confirmed } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      {confirmed === 'true' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-900 dark:text-green-400">
            Subscription confirmed! Welcome to BestBlogs.dev!
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            You can update your preferences below.
          </p>
        </div>
      )}
      <ManagePreferences token={token} />
    </div>
  );
}
