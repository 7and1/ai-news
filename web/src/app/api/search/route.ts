import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { advancedSearch, trackSearch, type AdvancedSearchParams } from '@/lib/db/search-queries';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import { incrementCounter, generateCorrelationId, setCorrelationId } from '@/lib/monitoring';
import { searchQuerySchema, z } from '@/lib/validation/schemas';

/**
 * Extended search schema with advanced parameters.
 */
const advancedSearchSchema = searchQuerySchema.extend({
  fields: z.string().optional(),
  category: z.array(z.string()).optional(),
  sourceCategory: z.array(z.string()).optional(),
  sourceId: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minImportance: z.string().optional(),
  maxImportance: z.string().optional(),
  sortBy: z.enum(['relevance', 'newest', 'oldest', 'importance']).optional(),
});

/**
 * Searches news articles by text query with advanced filters.
 *
 * GET /api/search
 *
 * Query parameters:
 *   q: Search query string (max 500 characters)
 *   limit: Maximum number of items to return (1-1000)
 *   cursor: Pagination cursor for next page
 *   fields: Comma-separated fields to search in
 *   category: Filter by category (multiple allowed)
 *   sourceCategory: Filter by source category (multiple allowed)
 *   sourceId: Filter by source ID (multiple allowed)
 *   language: Filter by language (multiple allowed)
 *   tags: Filter by tags (multiple allowed)
 *   startDate: Start date filter (ISO string)
 *   endDate: End date filter (ISO string)
 *   minImportance: Minimum importance score
 *   maxImportance: Maximum importance score
 *   sortBy: Sort order (relevance, newest, oldest, importance)
 *
 * Rate limiting: 20 requests per minute per IP (stricter due to search cost)
 */
export const GET = createMiddleware(
  {
    rateLimit: 'SEARCH',
    securityHeaders: true,
    cors: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);
    const startTime = Date.now();

    try {
      const searchParams = request.nextUrl.searchParams;

      // Build parameters object
      const rawParams: Record<string, string | string[]> = {
        q: (searchParams.get('q') ?? '').trim(),
        limit: searchParams.get('limit') ?? '',
        cursor: searchParams.get('cursor') ?? '',
      };

      // Add multi-value parameters
      for (const key of ['category', 'sourceCategory', 'sourceId', 'language', 'tags']) {
        const values = searchParams.getAll(key);
        if (values.length > 0) {
          rawParams[key] = values;
        }
      }

      // Add optional single-value parameters
      for (const key of [
        'fields',
        'startDate',
        'endDate',
        'minImportance',
        'maxImportance',
        'sortBy',
      ]) {
        const value = searchParams.get(key);
        if (value) {
          rawParams[key] = value;
        }
      }

      // Validate query parameters
      const params = advancedSearchSchema.safeParse(rawParams);

      if (!params.success) {
        throw new ValidationError(params.error.flatten());
      }

      const query = params.data;
      const advancedParams: AdvancedSearchParams = {
        q: query.q,
        limit: query.limit,
        cursor: query.cursor,
      };

      // Add advanced parameters if present
      if (query.fields) {
        advancedParams.fields = query.fields.split(',') as AdvancedSearchParams['fields'];
      }
      if (query.category?.length) {
        advancedParams.category = query.category;
      }
      if (query.sourceCategory?.length) {
        advancedParams.sourceCategory = query.sourceCategory;
      }
      if (query.sourceId?.length) {
        advancedParams.sourceId = query.sourceId;
      }
      if (query.language?.length) {
        advancedParams.language = query.language;
      }
      if (query.tags?.length) {
        advancedParams.tags = query.tags;
      }
      if (query.startDate) {
        advancedParams.startDate = query.startDate;
      }
      if (query.endDate) {
        advancedParams.endDate = query.endDate;
      }
      if (query.minImportance !== undefined) {
        advancedParams.minImportance = Number.parseInt(query.minImportance, 10);
      }
      if (query.maxImportance !== undefined) {
        advancedParams.maxImportance = Number.parseInt(query.maxImportance, 10);
      }
      if (query.sortBy) {
        advancedParams.sortBy = query.sortBy;
      }

      const result = await advancedSearch(advancedParams);

      // Track search asynchronously (don't block response)
      if (query.q) {
        trackSearch({
          query: query.q,
          resultsCount: result.items.length,
        }).catch(() => {
          // Silently fail tracking
        });
      }

      // Track metrics
      const duration = Date.now() - startTime;
      await incrementCounter('http_requests_total', 1, {
        method: 'GET',
        path: '/api/search',
        status: '2xx',
      });
      await incrementCounter('http_request_duration_ms', duration, {
        method: 'GET',
        path: '/api/search',
      });
      await incrementCounter('search_requests_total', 1, {
        hasResults: result.items.length > 0 ? 'true' : 'false',
      });

      const response = NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=15',
          'x-correlation-id': correlationId,
        },
      });

      return response;
    } catch (err) {
      await incrementCounter('http_errors_total', 1, {
        method: 'GET',
        path: '/api/search',
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
