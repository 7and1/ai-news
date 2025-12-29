import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { trackSearch, trackSearchClick } from '@/lib/db/search-queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case 'search':
        const queryId = await trackSearch({
          query: data.query ?? '',
          resultsCount: data.resultsCount ?? 0,
        });
        return NextResponse.json({ queryId });

      case 'click':
        await trackSearchClick({
          queryId: data.queryId ?? '',
          newsId: data.newsId ?? '',
        });
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Search tracking error:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}
