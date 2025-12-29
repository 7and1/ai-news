import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Go home
      </Link>
    </div>
  );
}
