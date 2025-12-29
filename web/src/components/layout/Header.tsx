'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

// =============================================================================
// ICONS - Inline SVG for zero runtime overhead
// =============================================================================
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RssIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" />
      <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NewsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v11.75A2.75 2.75 0 0016.75 18h-12A2.75 2.75 0 012 15.25V3.5zm3.75 7a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM5 5.75A.75.75 0 015.75 5h4.5a.75.75 0 01.75.75v2.5a.75.75 0 01-.75.75h-4.5A.75.75 0 015 8.25v-2.5z"
        clipRule="evenodd"
      />
      <path d="M16.5 6.5h-1v8.75a1.25 1.25 0 102.5 0V8a1.5 1.5 0 00-1.5-1.5z" />
    </svg>
  );
}

// =============================================================================
// THEME TOGGLE - Optimized with useTransition for better FID
// =============================================================================
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggle = () => {
    // Use transition for non-urgent theme updates
    startTransition(() => {
      const newValue = !isDark;
      setIsDark(newValue);
      document.documentElement.classList.toggle('dark', newValue);
      localStorage.setItem('theme', newValue ? 'dark' : 'light');
    });
  };

  if (!mounted) {
    // Reserve space to prevent CLS
    return <div className="h-9 w-9" aria-hidden="true" style={{ minWidth: '2.25rem' }} />;
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
      aria-label="Toggle dark mode"
      disabled={isPending}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

// =============================================================================
// HEADER COMPONENT - Performance optimized
// =============================================================================
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm text-white dark:bg-white dark:text-black">
            AI
          </span>
          <span className="text-zinc-950 dark:text-zinc-50">AI News</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-zinc-600 sm:gap-2 dark:text-zinc-300">
          <Link
            className="hidden rounded-lg px-3 py-2 hover:bg-zinc-100 hover:text-zinc-900 sm:block dark:hover:bg-zinc-800 dark:hover:text-white"
            href="/latest"
          >
            Latest
          </Link>
          <Link
            className="hidden rounded-lg px-3 py-2 hover:bg-zinc-100 hover:text-zinc-900 sm:block dark:hover:bg-zinc-800 dark:hover:text-white"
            href="/newsletter"
          >
            Newsletter
          </Link>
          <Link
            className="hidden rounded-lg px-3 py-2 hover:bg-zinc-100 hover:text-zinc-900 sm:block dark:hover:bg-zinc-800 dark:hover:text-white"
            href="/companies"
          >
            Companies
          </Link>
          <Link
            className="rounded-lg px-3 py-2 hover:bg-zinc-100 hover:text-zinc-900 sm:hidden dark:hover:bg-zinc-800 dark:hover:text-white"
            href="/latest"
            aria-label="Latest news"
          >
            <NewsIcon className="h-5 w-5" />
          </Link>
          <Link
            className="rounded-lg px-2 py-2 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            href="/search"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:block dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="RSS Feed"
          >
            <RssIcon className="h-5 w-5" />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
