// Request logging middleware for Next.js API routes
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  generateCorrelationId,
  generateRequestId,
  setCorrelationId,
  setRequestId,
  clearRequestContext,
  trackHttpRequest,
} from '@/lib/monitoring';

// Paths to skip logging (health, static assets, etc.)
const SKIP_PATTERNS = [/^\/_next\//, /^\/favicon\./, /^\/.*\.(ico|png|jpg|jpeg|gif|svg|css|js)$/];

function shouldSkipLogging(pathname: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Middleware to log all HTTP requests
 */
export async function requestLoggerMiddleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Skip logging for certain paths
  if (shouldSkipLogging(pathname)) {
    return NextResponse.next();
  }

  const startTime = Date.now();

  // Generate and set correlation/request IDs
  const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
  const requestId = generateRequestId();

  setCorrelationId(correlationId);
  setRequestId(requestId);

  // Create response with headers
  const response = NextResponse.next();

  // Add correlation ID to response headers
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-request-id', requestId);

  // We'll use response.headers to store timing for logging
  response.headers.set('x-request-start', String(startTime));

  // Log the request (this happens synchronously)
  // Note: We can't log response status here since we don't have it yet
  // The actual logging with status will be done via the responseEnded hook

  return response;
}

/**
 * Wrap an API route handler with logging
 */
export function withRequestLogging<
  T extends (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
>(handler: T, _options?: { logBody?: boolean; logQuery?: boolean }): T {
  return (async (request: NextRequest, ...args: unknown[]) => {
    const pathname = request.nextUrl.pathname;
    const startTime = Date.now();

    // Set up request context
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    const requestId = generateRequestId();

    setCorrelationId(correlationId);
    setRequestId(requestId);

    let statusCode = 200;

    try {
      const response = await handler(request, ...args);
      statusCode = response.status;

      // Add correlation ID to response
      response.headers.set('x-correlation-id', correlationId);
      response.headers.set('x-request-id', requestId);

      return response;
    } catch (error) {
      statusCode = 500;
      throw error;
    } finally {
      const duration = Date.now() - startTime;

      // Track the HTTP request as metrics
      await trackHttpRequest({
        method: request.method,
        path: pathname,
        statusCode,
        duration,
      });

      // Clean up request context
      clearRequestContext();
    }
  }) as T;
}

/**
 * Create a route handler with standardized error handling and logging
 */
export function createLoggedRoute<
  T extends (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
>(
  handler: T,
  options?: {
    logBody?: boolean;
    logQuery?: boolean;
  }
): T {
  return withRequestLogging(handler, options);
}
