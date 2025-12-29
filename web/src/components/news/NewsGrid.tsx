import type { NewsListItem } from '@/lib/db/types';

import { NewsCard } from './NewsCard';

export function NewsGrid({ items }: { items: NewsListItem[] }) {
  return (
    <div className="news-grid grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}
    </div>
  );
}
