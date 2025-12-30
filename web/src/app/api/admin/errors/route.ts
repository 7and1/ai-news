// Admin API for error tracking and management
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createMiddleware } from '@/lib/middleware';
import {
  listRecentErrors,
  getErrorStats,
  resolveError,
  reportError,
  logger,
  incrementCounter,
} from '@/lib/monitoring';

/**
 * GET /api/admin/errors - List and filter errors
 * Query params:
 *   - limit: number of errors to return (default: 50)
 *   - resolved: true | false | undefined (all)
 *   - stats: true | false - include stats in response
 */
export const GET = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'errors',
    }).catch(() => {});

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const resolvedParam = searchParams.get('resolved');
    const includeStats = searchParams.get('stats') === 'true';

    try {
      const [errors, stats] = await Promise.all([
        listRecentErrors({
          limit,
          resolved: resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined,
        }),
        includeStats ? getErrorStats() : null,
      ]);

      return NextResponse.json({
        timestamp: Date.now(),
        errors,
        stats,
        count: errors.length,
      });
    } catch (error) {
      await logger.error('Failed to fetch errors', { error });
      return NextResponse.json(
        { error: 'failed_to_fetch_errors', message: String(error) },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/admin/errors - Report a new error or resolve an existing one
 */
export const POST = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'errors',
      method: 'POST',
    }).catch(() => {});

    const reportSchema = z.object({
      action: z.enum(['report', 'resolve']),
      error: z
        .union([
          z.string(),
          z.object({
            message: z.string(),
            name: z.string().optional(),
            stack: z.string().optional(),
          }),
        ])
        .optional(),
      context: z.record(z.unknown()).optional(),
      fingerprint: z.string().optional(),
    });

    const body = await request.json().catch(() => null);
    const parsed = reportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, error, context, fingerprint } = parsed.data;

    try {
      switch (action) {
        case 'report': {
          if (!error) {
            return NextResponse.json(
              {
                error: 'error_required',
                message: 'Error object is required for report action',
              },
              { status: 400 }
            );
          }
          const errorFingerprint = await reportError(error, context);
          return NextResponse.json({
            ok: true,
            fingerprint: errorFingerprint,
            message: 'Error reported successfully',
          });
        }

        case 'resolve': {
          if (!fingerprint) {
            return NextResponse.json(
              {
                error: 'fingerprint_required',
                message: 'Fingerprint is required for resolve action',
              },
              { status: 400 }
            );
          }
          const resolved = await resolveError(fingerprint);
          return NextResponse.json({
            ok: resolved,
            fingerprint,
            message: resolved ? 'Error resolved' : 'Error not found',
          });
        }

        default:
          return NextResponse.json(
            { error: 'invalid_action', message: 'Unknown action' },
            { status: 400 }
          );
      }
    } catch (err) {
      await logger.error('Failed to process error action', { error: err });
      return NextResponse.json({ error: 'action_failed', message: String(err) }, { status: 500 });
    }
  }
);
