// Error detail endpoint
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddleware } from '@/lib/middleware';
import { getError, incrementCounter, logger } from '@/lib/monitoring';

/**
 * GET /api/admin/errors/[fingerprint] - Get specific error details
 */
export const GET = createMiddleware<{ params: Promise<{ fingerprint: string }> }>(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (_request: NextRequest, context) => {
    void incrementCounter('admin_metrics_requests_total', 1, { endpoint: 'error_detail' }).catch(
      () => {}
    );

    if (!context?.params) {
      return NextResponse.json({ error: 'bad_request', message: 'Missing route params' }, { status: 400 });
    }

    const { fingerprint } = await context.params;

    try {
      const error = await getError(fingerprint);

      if (!error) {
        return NextResponse.json(
          { error: 'not_found', message: 'Error not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ error });
    } catch (err) {
      await logger.error('Failed to fetch error', { error: err, fingerprint });
      return NextResponse.json({ error: 'fetch_failed', message: String(err) }, { status: 500 });
    }
  }
);
