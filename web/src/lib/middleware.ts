/**
 * API middleware utilities.
 * Provides composable middleware functions for API routes.
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getEnv } from './d1';
import {
  createSecurityHeaders,
  handleCorsPreflight,
  createSecurityConfigFromEnv,
} from './security/headers';
import { JwtError, authenticateRequest } from './security/jwt';
import { RateLimiter, RateLimitTier, createKvRateLimiter } from './security/rate-limit';
import { compareSecrets } from './security/timing';

/**
 * Standard API error response.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'internal_error'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Rate limit exceeded error.
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 429, 'rate_limit_exceeded');
    this.retryAfter = retryAfter;
  }

  retryAfter: number;
}

/**
 * Authentication error.
 */
export class AuthError extends ApiError {
  constructor(message = 'Authentication failed', code = 'auth_failed') {
    super(message, 401, code);
  }
}

/**
 * Validation error.
 */
export class ValidationError extends ApiError {
  constructor(details: unknown) {
    super('Validation failed', 400, 'validation_error');
    this.details = details;
  }

  details: unknown;
}

/**
 * Not found error.
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'not_found');
  }
}

/**
 * Creates a standardized JSON error response.
 */
export function errorResponse(error: Error | ApiError, includeStackTrace = false): NextResponse {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const code = error instanceof ApiError ? error.code : 'internal_error';

  const body: Record<string, unknown> = {
    error: code,
    message: error.message,
  };

  if (error instanceof ValidationError) {
    body.details = error.details;
  }

  if (error instanceof RateLimitError) {
    body.retry_after = error.retryAfter;
  }

  if (includeStackTrace && error.stack) {
    body.stack = error.stack;
  }

  return NextResponse.json(body, { status: statusCode });
}

/**
 * Wraps an API handler with error handling.
 * Catches errors and returns appropriate error responses.
 */
export function withErrorHandler<T>(
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>,
  options: { includeStackTrace?: boolean } = {}
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof ApiError) {
        return errorResponse(error, options.includeStackTrace);
      }

      return errorResponse(new Error('An unexpected error occurred'), options.includeStackTrace);
    }
  };
}

/**
 * Middleware configuration.
 */
export interface MiddlewareConfig {
  /** Require authentication via secret */
  requireSecret?: { key: 'INGEST_SECRET' | 'CRON_SECRET' } | boolean;
  /** Require JWT authentication */
  requireJwt?: boolean | { type: 'admin' | 'service' };
  /** Apply rate limiting */
  rateLimit?: keyof typeof RateLimitTier;
  /** Apply security headers */
  securityHeaders?: boolean;
  /** Apply CORS */
  cors?: boolean;
}

/**
 * Creates a middleware chain for API routes.
 */
export function createMiddleware<T = unknown>(
  config: MiddlewareConfig,
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    const env = await getEnv();

    // Handle OPTIONS preflight for CORS
    if (request.method === 'OPTIONS' && config.cors) {
      const envRecord = env as unknown as Record<string, string | undefined>;
      const securityConfig = createSecurityConfigFromEnv(envRecord);
      return handleCorsPreflight(
        request.headers.get('origin'),
        securityConfig.cors
      ) as NextResponse;
    }

    // Check secret authentication if required
    if (config.requireSecret) {
      const secretKey =
        typeof config.requireSecret === 'boolean' ? 'INGEST_SECRET' : config.requireSecret.key;

      const headerName = secretKey === 'INGEST_SECRET' ? 'x-ingest-secret' : 'x-cron-secret';
      const secret =
        request.headers.get(headerName) ||
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      const expectedSecret = env[secretKey];

      if (!expectedSecret || !compareSecrets(expectedSecret, secret)) {
        // Add a small delay to prevent timing attacks on auth failures
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100));
        throw new AuthError('Invalid authentication credentials');
      }
    }

    // Check JWT authentication if required
    if (config.requireJwt) {
      const jwtSecret = env.JWT_SECRET;
      if (!jwtSecret) {
        throw new AuthError('JWT authentication not configured');
      }

      const authHeader = request.headers.get('authorization');

      try {
        const payload = await authenticateRequest(authHeader, jwtSecret);

        // Check token type if specified
        if (typeof config.requireJwt === 'object') {
          if (payload.type !== config.requireJwt.type) {
            throw new AuthError('Invalid token type for this endpoint', 'invalid_token_type');
          }
        }

        // Add payload to request headers for downstream use
        const headers = new Headers(request.headers);
        headers.set('x-user-id', payload.sub);
        headers.set('x-user-type', payload.type);
        request = new Request(request, { headers }) as NextRequest;
      } catch (error) {
        if (error instanceof JwtError) {
          throw new AuthError(`JWT validation failed: ${error.message}`, error.code.toLowerCase());
        }
        throw error;
      }
    }

    // Apply rate limiting if configured
    if (config.rateLimit) {
      const enabled = env.RATE_LIMIT_ENABLED !== 'false';
      if (enabled) {
        const tier = RateLimitTier[config.rateLimit];
        const rateLimitKv = env.RATE_LIMIT_KV as KVNamespace | undefined;

        let limiter: RateLimiter;
        if (rateLimitKv) {
          limiter = createKvRateLimiter(tier, rateLimitKv as any);
        } else {
          limiter = new RateLimiter(tier);
        }

        const result = await limiter.checkRequest(request);

        if (!result.allowed) {
          throw new RateLimitError(result.retryAfter);
        }

        // Add rate limit info to the request for downstream handlers
        const headers = new Headers(request.headers);
        headers.set('x-ratelimit-limit', String(result.limit));
        headers.set('x-ratelimit-remaining', String(Math.max(0, result.limit - result.current)));
        headers.set('x-ratelimit-reset', String(result.resetAfter));
        request = new Request(request, { headers }) as NextRequest;
      }
    }

    // Call the handler
    const response = await handler(request, context);

    // Apply security headers to the response
    if (config.securityHeaders) {
      const envRecord = env as unknown as Record<string, string | undefined>;
      const securityConfig = createSecurityConfigFromEnv(envRecord);
      const securityHeaders = createSecurityHeaders(securityConfig, request.headers.get('origin'));

      for (const [key, value] of securityHeaders.entries()) {
        response.headers.set(key, value);
      }
    }

    // Add rate limit headers if they were computed
    if (config.rateLimit && request.headers.has('x-ratelimit-limit')) {
      response.headers.set('X-RateLimit-Limit', request.headers.get('x-ratelimit-limit')!);
      response.headers.set('X-RateLimit-Remaining', request.headers.get('x-ratelimit-remaining')!);
      response.headers.set('X-RateLimit-Reset', request.headers.get('x-ratelimit-reset')!);
    }

    return response;
  };
}

/**
 * Composes multiple middleware functions.
 * Middleware are executed in order.
 */
export function composeMiddleware<T>(
  ...middleware: Array<(request: NextRequest, context: T) => Promise<NextRequest | Response>>
) {
  return async (
    request: NextRequest,
    context: T,
    handler: (request: NextRequest, context: T) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    let currentRequest = request;

    for (const mw of middleware) {
      const result = await mw(currentRequest, context);
      if (result instanceof Response) {
        // Middleware returned a response (early exit)
        return result as NextResponse;
      }
      currentRequest = result as NextRequest;
    }

    return handler(currentRequest, context);
  };
}

/**
 * Validates request body against a Zod schema.
 */
export async function validateRequestBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const json = await request.json();
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.flatten());
    }
    throw new ValidationError('Invalid JSON');
  }
}

/**
 * Validates query parameters against a Zod schema.
 */
export function validateQueryParams<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  const rawParams: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    rawParams[key] = value;
  }

  try {
    return schema.parse(rawParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.flatten());
    }
    throw new ValidationError('Invalid query parameters');
  }
}

/**
 * Extracts the user ID from authenticated request headers.
 * Returns null if not authenticated.
 */
export function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

/**
 * Extracts the user type from authenticated request headers.
 * Returns null if not authenticated.
 */
export function getUserType(request: NextRequest): 'admin' | 'service' | null {
  const type = request.headers.get('x-user-type');
  if (type === 'admin' || type === 'service') {
    return type;
  }
  return null;
}

/**
 * Checks if the current user is an admin.
 */
export function isAdmin(request: NextRequest): boolean {
  return getUserType(request) === 'admin';
}

/**
 * Checks if the current user is a service account.
 */
export function isService(request: NextRequest): boolean {
  return getUserType(request) === 'service';
}

/**
 * Requires admin authentication.
 * Throws an error if the current user is not an admin.
 */
export function requireAdmin(request: NextRequest): void {
  if (!isAdmin(request)) {
    throw new AuthError('Admin access required', 'admin_required');
  }
}

/**
 * Rate limiting middleware factory.
 * Creates a middleware function with the specified rate limit tier.
 */
export function withRateLimit(tier: keyof typeof RateLimitTier) {
  return async (request: NextRequest, _context: unknown): Promise<NextRequest | Response> => {
    const env = await getEnv();
    const enabled = env.RATE_LIMIT_ENABLED !== 'false';

    if (!enabled) {
      return request;
    }

    const rateLimitTier = RateLimitTier[tier];
    const rateLimitKv = env.RATE_LIMIT_KV as KVNamespace | undefined;

    let limiter: RateLimiter;
    if (rateLimitKv) {
      limiter = createKvRateLimiter(rateLimitTier, rateLimitKv as any);
    } else {
      limiter = new RateLimiter(rateLimitTier);
    }

    const result = await limiter.checkRequest(request);

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retry_after: result.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAfter),
          },
        }
      );
    }

    // Add rate limit info to request for downstream use
    const headers = new Headers(request.headers);
    headers.set('x-ratelimit-limit', String(result.limit));
    headers.set('x-ratelimit-remaining', String(Math.max(0, result.limit - result.current)));
    headers.set('x-ratelimit-reset', String(result.resetAfter));

    return new Request(request, { headers }) as NextRequest;
  };
}

/**
 * Secret authentication middleware.
 * Validates x-ingest-secret header against environment.
 */
export async function withSecretAuth(
  request: NextRequest,
  secretKey: 'INGEST_SECRET' | 'CRON_SECRET' = 'INGEST_SECRET'
): Promise<NextRequest | Response> {
  const env = await getEnv();
  const headerName = secretKey === 'INGEST_SECRET' ? 'x-ingest-secret' : 'x-cron-secret';
  const secret =
    request.headers.get(headerName) ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const expectedSecret = env[secretKey];

  if (!expectedSecret || !compareSecrets(expectedSecret, secret)) {
    // Add delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100));

    return NextResponse.json(
      { error: 'unauthorized' },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="API"',
        },
      }
    );
  }

  return request;
}

/**
 * JWT authentication middleware.
 * Validates Bearer token against JWT_SECRET.
 */
export async function withJwtAuth(
  request: NextRequest,
  options?: { type?: 'admin' | 'service' }
): Promise<NextRequest | Response> {
  const env = await getEnv();
  const jwtSecret = env.JWT_SECRET;

  if (!jwtSecret) {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');

  try {
    const payload = await authenticateRequest(authHeader, jwtSecret);

    // Check token type if specified
    if (options?.type && payload.type !== options.type) {
      return NextResponse.json({ error: 'invalid_token_type' }, { status: 403 });
    }

    // Add user info to headers
    const headers = new Headers(request.headers);
    headers.set('x-user-id', payload.sub);
    headers.set('x-user-type', payload.type);

    return new Request(request.url, {
      ...request,
      headers,
    }) as NextRequest;
  } catch (error) {
    if (error instanceof JwtError) {
      return NextResponse.json(
        { error: error.code.toLowerCase(), message: error.message },
        { status: 401 }
      );
    }
    throw error;
  }
}

/**
 * Security headers middleware.
 * Adds security headers to the response.
 */
export function withSecurityHeaders(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const env = await getEnv();
    const envRecord = env as unknown as Record<string, string | undefined>;
    const securityConfig = createSecurityConfigFromEnv(envRecord);
    const response = await handler(request);

    const securityHeaders = createSecurityHeaders(securityConfig, request.headers.get('origin'));

    for (const [key, value] of securityHeaders.entries()) {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    }

    return response;
  };
}
