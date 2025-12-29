import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { listNews } from '@/lib/db/queries';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import { incrementCounter, generateCorrelationId, setCorrelationId } from '@/lib/monitoring';
import { newsListQuerySchema } from '@/lib/validation/schemas';

/**
 * Lists news articles with filtering and pagination.
 *
 * GET /api/news
 *
 * Query parameters:
 *   limit: Maximum number of items to return (1-1000)
 *   cursor: Pagination cursor for next page
 *   minImportance: Minimum importance score (0-100)
 *   language: Filter by language code (en, zh, es, fr, de, ja)
 *   category: Filter by category
 *   sourceCategory: Filter by source category
 *   tag: Filter by tag
 *
 * Rate limiting: 60 requests per minute per IP
 */
export const GET = createMiddleware(
  {
    rateLimit: 'PUBLIC',
    securityHeaders: true,
    cors: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);
    const startTime = Date.now();

    try {
      // Validate query parameters
      const params = newsListQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams.entries())
      );

      if (!params.success) {
        throw new ValidationError(params.error.flatten());
      }

      const query = params.data;

      const result = await listNews({
        limit: query.limit,
        cursor: query.cursor,
        minImportance: query.minImportance,
        language: query.language,
        category: query.category,
        sourceCategory: query.sourceCategory,
        tag: query.tag,
      });

      // Track metrics
      const duration = Date.now() - startTime;
      await incrementCounter('http_requests_total', 1, {
        method: 'GET',
        path: '/api/news',
        status: '2xx',
      });
      await incrementCounter('http_request_duration_ms', duration, {
        method: 'GET',
        path: '/api/news',
      });

      const response = NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
          'x-correlation-id': correlationId,
        },
      });

      return response;
    } catch (err) {
      await incrementCounter('http_errors_total', 1, {
        method: 'GET',
        path: '/api/news',
        status: '500',
      });
      throw err;
    }
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
