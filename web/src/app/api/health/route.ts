// Enhanced health check endpoint with comprehensive checks
import { NextResponse } from 'next/server';

import { performHealthCheck, livenessCheck, readinessCheck } from '@/lib/monitoring';

/**
 * Simple health check (liveness) - is the service running?
 * GET /api/health
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'full';

  try {
    switch (type) {
      case 'live':
      case 'liveness': {
        // K8s-style liveness probe
        const live = await livenessCheck();
        return NextResponse.json({
          status: 'ok',
          timestamp: Date.now(),
          ...live,
        });
      }

      case 'ready':
      case 'readiness': {
        // K8s-style readiness probe
        const ready = await readinessCheck();
        const status = ready.ready ? 200 : 503;
        return NextResponse.json(
          {
            status: ready.ready ? 'ready' : 'not_ready',
            timestamp: Date.now(),
            checks: ready.checks,
          },
          { status }
        );
      }

      case 'full':
      default: {
        // Comprehensive health check
        const health = await performHealthCheck();
        const httpStatus = health.status === 'unhealthy' ? 503 : 200;
        return NextResponse.json(health, { status: httpStatus });
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
