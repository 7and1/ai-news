import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getNewsById } from '@/lib/db/queries';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import { newsByIdPathSchema } from '@/lib/validation/schemas';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single news article by ID.
 *
 * GET /api/news/[id]
 *
 * Path parameters:
 *   id: Article ID (4-50 characters)
 *
 * Rate limiting: 100 requests per minute per IP
 */
export const GET = createMiddleware<RouteContext>(
  {
    rateLimit: 'ITEM',
    securityHeaders: true,
    cors: true,
  },
  async (_request: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    if (!context?.params) {
      return NextResponse.json({ error: 'not_found', message: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;

    // Validate path parameter
    const params = newsByIdPathSchema.safeParse({ id });
    if (!params.success) {
      throw new ValidationError(params.error.flatten());
    }

    const news = await getNewsById(params.data.id);
    if (!news) {
      return NextResponse.json(
        { error: 'not_found', message: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(news, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    });
  }
);

/**
 * OPTIONS handler for CORS preflight.
 */
export const OPTIONS = withSecurityHeaders(async (): Promise<NextResponse> => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
