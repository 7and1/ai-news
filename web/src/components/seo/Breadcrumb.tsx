import Link from 'next/link';

import type { BreadcrumbItem } from '@/lib/db/types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm">
      {items.map((item, index) => (
        <div key={item.href} className="flex items-center">
          {index > 0 && (
            <span className="mx-2 text-zinc-400" aria-hidden="true">
              /
            </span>
          )}
          {item.current ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
          ) : (
            <Link
              href={item.href}
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {item.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
