import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSearchSuggestions } from '@/lib/db/search-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = searchParams.get('limit');

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [], types: [] });
  }

  const result = await getSearchSuggestions(q, limit ? Number(limit) : undefined);

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=300', // 5 minutes
    },
  });
}
