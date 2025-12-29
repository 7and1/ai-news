// Error tracking and reporting utility for BestBlogs.dev
import { getEnv } from '@/lib/d1';

import { logger } from './logger';
import type { ErrorContext, ErrorEntry } from './types';

/**
 * Generate a fingerprint for grouping similar errors
 */
function generateErrorFingerprint(message: string, stack?: string): string {
  // Remove dynamic content like IDs, timestamps, etc.
  const normalizedMessage = message
    .replace(/\d{10,}/g, 'TIMESTAMP')
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
    .replace(/\b[a-f0-9]{16,}\b/g, 'ID')
    .replace(/\b\d+\b/g, 'N');

  const normalizedStack = stack
    ? stack
        .split('\n')
        .slice(0, 5)
        .map((line) => line.replace(/\b\d+\b/g, 'N'))
        .join('\n')
    : '';

  const normalized = normalizedMessage + '\n' + normalizedStack;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return 'fp_' + Math.abs(hash).toString(36);
}

/**
 * Extract useful information from an error
 */
function parseError(err: unknown): {
  message: string;
  stack?: string;
  name: string;
} {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      name: err.name,
    };
  }

  if (typeof err === 'string') {
    return {
      message: err,
      name: 'Error',
    };
  }

  if (err && typeof err === 'object') {
    const message = (err as Record<string, unknown>).message;
    const stack = (err as Record<string, unknown>).stack;
    const name = (err as Record<string, unknown>).name || 'Error';

    return {
      message: typeof message === 'string' ? message : JSON.stringify(err),
      stack: typeof stack === 'string' ? stack : undefined,
      name: typeof name === 'string' ? name : 'Error',
    };
  }

  return {
    message: String(err),
    name: 'Unknown',
  };
}

/**
 * Report an error to the error tracking system
 */
export async function reportError(err: unknown, context?: ErrorContext): Promise<string> {
  const { message, stack, name } = parseError(err);
  const fingerprint = generateErrorFingerprint(message, stack);
  const timestamp = Date.now();

  // Log to console
  await logger.error('[' + name + '] ' + message, {
    ...context,
    fingerprint,
    stack,
  }).catch(() => {});

  // Store in KV for aggregation
  try {
    const env = await getEnv();
    if (env.ERROR_TRACKING) {
      // Check if this error has been seen before
      const existingKey = 'error:' + fingerprint;
      const existing = await env.ERROR_TRACKING.get(existingKey, 'json');

      let errorEntry: ErrorEntry;

      if (existing && typeof existing === 'object') {
        // Update existing error
        const existingEntry = existing as ErrorEntry;
        errorEntry = {
          ...existingEntry,
          count: existingEntry.count + 1,
          lastSeen: timestamp,
          resolved: false, // Mark as unresolved since it occurred again
          context: { ...existingEntry.context, ...context },
        };
      } else {
        // Create new error entry
        errorEntry = {
          id: fingerprint,
          timestamp,
          message,
          stack,
          name,
          context,
          fingerprint,
          resolved: false,
          count: 1,
          firstSeen: timestamp,
          lastSeen: timestamp,
        };
      }

      // Store with 30 day TTL
      await env.ERROR_TRACKING.put(existingKey, JSON.stringify(errorEntry), {
        expirationTtl: 30 * 24 * 60 * 60,
      });

	      // Also add to time-series index for querying
	      const timeKey = 'error:index:' + new Date(timestamp).toISOString().substring(0, 10);
	      const index = await env.ERROR_TRACKING.get(timeKey, 'json');
	      const errorList = Array.isArray(index) ? (index as string[]) : [];
	      errorList.push(fingerprint);

      await env.ERROR_TRACKING.put(
        timeKey,
        JSON.stringify(errorList),
        { expirationTtl: 90 * 24 * 60 * 60 } // 90 days
      );
    }
  } catch (kvError) {
    // Silently fail if KV operations fail
    console.warn('Failed to store error in KV:', kvError);
  }

  return fingerprint;
}

/**
 * Mark an error as resolved
 */
export async function resolveError(fingerprint: string): Promise<boolean> {
  try {
    const env = await getEnv();
    if (env.ERROR_TRACKING) {
      const key = 'error:' + fingerprint;
      const existing = await env.ERROR_TRACKING.get(key, 'json');

      if (existing && typeof existing === 'object') {
        const errorEntry = existing as ErrorEntry;
        errorEntry.resolved = true;
        await env.ERROR_TRACKING.put(key, JSON.stringify(errorEntry), {
          expirationTtl: 30 * 24 * 60 * 60,
        });
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Get error by fingerprint
 */
export async function getError(fingerprint: string): Promise<ErrorEntry | null> {
  try {
    const env = await getEnv();
    if (env.ERROR_TRACKING) {
      const data = await env.ERROR_TRACKING.get('error:' + fingerprint, 'json');
      return data as ErrorEntry | null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * List recent errors
 */
export async function listRecentErrors(options: {
  limit?: number;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<ErrorEntry[]> {
  const { limit = 50, resolved } = options;
  const errors: ErrorEntry[] = [];

  try {
    const env = await getEnv();
    if (env.ERROR_TRACKING) {
      // List keys with error: prefix
      const keys = await env.ERROR_TRACKING.list({ prefix: 'error:' });

      for (const key of keys.keys.slice(0, limit * 2)) {
        const data = await env.ERROR_TRACKING.get(key.name, 'json');
        if (data && typeof data === 'object') {
          const entry = data as ErrorEntry;
          if (resolved === undefined || entry.resolved === resolved) {
            errors.push(entry);
          }
        }
        if (errors.length >= limit) {break;}
      }
    }
  } catch {
    return [];
  }

  // Sort by last seen descending
  return errors.sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Get error statistics
 */
export async function getErrorStats(): Promise<{
  total: number;
  unresolved: number;
  byType: Record<string, number>;
  topErrors: Array<{ fingerprint: string; count: number; message: string }>;
}> {
  const stats = {
    total: 0,
    unresolved: 0,
    byType: {} as Record<string, number>,
    topErrors: [] as Array<{
      fingerprint: string;
      count: number;
      message: string;
    }>,
  };

  try {
    const env = await getEnv();
    if (env.ERROR_TRACKING) {
      const keys = await env.ERROR_TRACKING.list({ prefix: 'error:' });

      for (const key of keys.keys) {
        const data = await env.ERROR_TRACKING.get(key.name, 'json');
        if (data && typeof data === 'object') {
          const entry = data as ErrorEntry;
          stats.total++;
          if (!entry.resolved) {stats.unresolved++;}

          stats.byType[entry.name] = (stats.byType[entry.name] || 0) + 1;

          stats.topErrors.push({
            fingerprint: entry.fingerprint,
            count: entry.count,
            message: entry.message,
          });
        }
      }
    }
  } catch {
    return stats;
  }

  // Sort top errors by count
  stats.topErrors.sort((a, b) => b.count - a.count);
  stats.topErrors = stats.topErrors.slice(0, 10);

  return stats;
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      await reportError(err, context);
      throw err;
    }
  }) as T;
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandler(): void {
  if (typeof self === 'undefined') {return;}

  // Handle unhandled promise rejections
  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, {
      type: 'unhandledrejection',
    }).catch(() => {
      // Silently fail
    });
  });

  // Handle uncaught errors in Cloudflare Workers
  if (typeof addEventListener === 'function') {
    addEventListener('error', (event: ErrorEvent) => {
      reportError(event.error || event.message, {
        type: 'uncaughterror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }).catch(() => {
        // Silently fail
      });
    });
  }
}

/**
 * Create an HTTP error with status code
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Common HTTP error factories
 */
export const Errors = {
  badRequest: (message: string = 'Bad Request') => new HttpError(400, message, 'BAD_REQUEST'),
  unauthorized: (message: string = 'Unauthorized') => new HttpError(401, message, 'UNAUTHORIZED'),
  forbidden: (message: string = 'Forbidden') => new HttpError(403, message, 'FORBIDDEN'),
  notFound: (message: string = 'Not Found') => new HttpError(404, message, 'NOT_FOUND'),
  conflict: (message: string = 'Conflict') => new HttpError(409, message, 'CONFLICT'),
  tooManyRequests: (message: string = 'Too Many Requests') =>
    new HttpError(429, message, 'TOO_MANY_REQUESTS'),
  internal: (message: string = 'Internal Server Error') =>
    new HttpError(500, message, 'INTERNAL_ERROR'),
  serviceUnavailable: (message: string = 'Service Unavailable') =>
    new HttpError(503, message, 'SERVICE_UNAVAILABLE'),
};
