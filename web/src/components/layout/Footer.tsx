import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-10 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-xs text-white dark:bg-white dark:text-black">
                AI
              </span>
              AI News
            </div>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Daily AI industry updates. Aggregated, clustered, and summarized.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Browse</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/latest" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                  Latest News
                </Link>
              </li>
              <li>
                <Link href="/companies" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                  Companies
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Subscribe</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  RSS Feed
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Legal</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <span className="text-zinc-400 dark:text-zinc-500">Privacy Policy</span>
              </li>
              <li>
                <span className="text-zinc-400 dark:text-zinc-500">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-zinc-200 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p>&copy; {new Date().getFullYear()} AI News. All rights reserved.</p>
          <p className="text-zinc-400">Built for speed, SEO, and daily updates.</p>
        </div>
      </div>
    </footer>
  );
}
