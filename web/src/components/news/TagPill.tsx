import Link from 'next/link';

export function TagPill({ tag }: { tag: string }) {
  return (
    <Link
      href={`/tags/${encodeURIComponent(tag)}`}
      className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      #{tag}
    </Link>
  );
}
