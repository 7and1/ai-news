import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { listDueSources, updateSourceCrawlStatus } from '@/lib/db/queries';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import {
  BusinessMetrics,
  incrementCounter,
  logger,
  generateCorrelationId,
  setCorrelationId,
  reportError,
} from '@/lib/monitoring';
import { adminSourceUpdateSchema, adminSourcesQuerySchema } from '@/lib/validation/schemas';

/**
 * Lists sources that are due for crawling.
 *
 * GET /api/admin/sources
 *
 * Headers:
 *   x-ingest-secret: Shared secret for authentication
 *   Authorization: Bearer <secret> (alternative to x-ingest-secret)
 *
 * Query parameters:
 *   limit: Maximum number of sources to return (default: 200)
 *
 * Rate limiting: 30 requests per minute
 */
export const GET = createMiddleware(
  {
    requireSecret: { key: 'INGEST_SECRET' },
    rateLimit: 'ADMIN',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);

    try {
      // Validate query parameters
      const params = adminSourcesQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams.entries())
      );

      if (!params.success) {
        throw new ValidationError(params.error.flatten());
      }

      const sources = await listDueSources({
        limit: params.data.limit,
      });

      await incrementCounter('http_requests_total', 1, {
        method: 'GET',
        path: '/api/admin/sources',
        status: '2xx',
      });

      await logger.info('Due sources fetched', {
        count: sources.length,
        correlationId,
      });

      const response = NextResponse.json({ sources });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (err) {
      await reportError(err, { endpoint: '/api/admin/sources', correlationId });
      await incrementCounter('http_errors_total', 1, {
        method: 'GET',
        path: '/api/admin/sources',
        status: '500',
      });
      throw err;
    }
  }
);

/**
 * Updates source crawl status after a crawl attempt.
 *
 * POST /api/admin/sources
 *
 * Headers:
 *   x-ingest-secret: Shared secret for authentication
 *   Authorization: Bearer <secret> (alternative to x-ingest-secret)
 *
 * Body:
 *   id: Source ID
 *   crawledAt: Timestamp of the crawl
 *   success: Whether the crawl succeeded
 *   errorCountDelta: Optional change to error count
 *
 * Rate limiting: 30 requests per minute
 */
export const POST = createMiddleware(
  {
    requireSecret: { key: 'INGEST_SECRET' },
    rateLimit: 'ADMIN',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);

    try {
      // Validate request body
      const json = await request.json().catch(() => null);
      const parsed = adminSourceUpdateSchema.safeParse(json);

      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten());
      }

      await updateSourceCrawlStatus(parsed.data);

      // Track source crawl metrics
      await BusinessMetrics.sourceCrawled(parsed.data.id, parsed.data.success);

      await incrementCounter('http_requests_total', 1, {
        method: 'POST',
        path: '/api/admin/sources',
        status: '2xx',
      });

      await logger.info('Source crawl status updated', {
        sourceId: parsed.data.id,
        success: parsed.data.success,
        correlationId,
      });

      const response = NextResponse.json({ ok: true });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (err) {
      await reportError(err, { endpoint: '/api/admin/sources', correlationId });
      await incrementCounter('http_errors_total', 1, {
        method: 'POST',
        path: '/api/admin/sources',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
