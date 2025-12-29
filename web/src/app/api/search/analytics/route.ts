import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { getPopularSearches, getZeroResultSearches } from '@/lib/db/search-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'popular';
  const limit = searchParams.get('limit');

  const parsedLimit = limit ? Number(limit) : undefined;

  switch (type) {
    case 'popular':
      const popular = await getPopularSearches(parsedLimit);
      return NextResponse.json(popular, {
        headers: { 'Cache-Control': 'public, max-age=600' }, // 10 minutes
      });

    case 'zero-results':
      const zeroResults = await getZeroResultSearches(parsedLimit);
      return NextResponse.json(
        { searches: zeroResults },
        {
          headers: { 'Cache-Control': 'public, max-age=600' },
        }
      );

    default:
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
}
