// Admin API for metrics and monitoring data
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createMiddleware } from '@/lib/middleware';
import {
  getAllMetrics,
  exportPrometheusMetrics,
  getErrorStats,
  logger,
  incrementCounter,
} from '@/lib/monitoring';

/**
 * GET /api/admin/metrics - Get all metrics
 * Query params:
 *   - format: json | prometheus (default: json)
 *   - since: timestamp to filter metrics from
 */
export const GET = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    // Track the request
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'metrics',
    }).catch(() => {});

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    try {
      if (format === 'prometheus') {
        const prometheus = await exportPrometheusMetrics();
        return new NextResponse(prometheus, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4',
            'Cache-Control': 'no-cache',
          },
        });
      }

    // JSON format - get comprehensive metrics
    const [metrics, errorStats] = await Promise.all([getAllMetrics(), getErrorStats()]);

    // Calculate summary statistics
    const summary = {
      totalRequests: sumCounters(metrics.counters, 'http_requests_total'),
      totalErrors: sumCounters(metrics.counters, 'http_errors_total'),
      avgResponseTime: calculateAvgResponseTime(metrics.histograms),
      errorRate: 0,
    };

      if (summary.totalRequests > 0) {
        summary.errorRate = summary.totalErrors / summary.totalRequests;
      }

      return NextResponse.json({
        timestamp: Date.now(),
        summary,
        metrics: {
          counters: aggregateCounters(metrics.counters),
          gauges: metrics.gauges,
          histograms: summarizeHistograms(metrics.histograms),
        },
        errors: errorStats,
      });
    } catch (error) {
      await logger.error('Failed to fetch metrics', { error });
      return NextResponse.json(
        { error: 'failed_to_fetch_metrics', message: String(error) },
        { status: 500 }
      );
    }
  }
);

/**
 * Sum counter values by name pattern
 */
function sumCounters(
  counters: Array<{ name: string; values: Array<{ value: number }> }>,
  pattern: string
): number {
  return counters
    .filter((c) => c.name === pattern || c.name.startsWith(pattern))
    .reduce((sum, c) => sum + c.values.reduce((v, item) => v + item.value, 0), 0);
}

/**
 * Calculate average response time from histograms
 */
function calculateAvgResponseTime(
  histograms: Array<{ name: string; sum: number; count: number }>
): number {
  const responseTimeHist = histograms.find((h) => h.name === 'http_request_duration_ms');
  if (!responseTimeHist || responseTimeHist.count === 0) {
    return 0;
  }
  return responseTimeHist.sum / responseTimeHist.count;
}

/**
 * Aggregate counters by name
 */
function aggregateCounters(
  counters: Array<{
    name: string;
    values: Array<{ value: number; labels?: Record<string, string> }>;
  }>
) {
  const byName = new Map<string, number>();

  for (const counter of counters) {
    const sum = counter.values.reduce((acc, v) => acc + v.value, 0);
    byName.set(counter.name, (byName.get(counter.name) || 0) + sum);
  }

  return Object.fromEntries(byName);
}

/**
 * Summarize histograms with percentiles
 */
function summarizeHistograms(
  histograms: Array<{
    name: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    labels?: Record<string, string>;
  }>
) {
  return histograms.map((h) => ({
    name: h.name,
    count: h.count,
    avg: h.count > 0 ? h.sum / h.count : 0,
    min: h.min,
    max: h.max,
    labels: h.labels,
  }));
}

/**
 * POST /api/admin/metrics - Record custom metrics
 */
export const POST = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    // Track the request
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'metrics',
      method: 'POST',
    }).catch(() => {});

  const schema = z.object({
    type: z.enum(['counter', 'gauge', 'histogram']),
    name: z.string().min(1),
    value: z.number(),
    labels: z.record(z.string()).optional(),
  });

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, name, value, labels } = parsed.data;

    try {
      const { incrementCounter, recordHistogram, setGauge } = await import('@/lib/monitoring');

      switch (type) {
        case 'counter':
          await incrementCounter(name, value, labels);
          break;
        case 'gauge':
          await setGauge(name, value, labels);
          break;
        case 'histogram':
          await recordHistogram(name, value, labels);
          break;
      }

      return NextResponse.json({ ok: true, type, name, value, labels });
    } catch (error) {
      await logger.error('Failed to record metric', { error });
      return NextResponse.json(
        { error: 'failed_to_record_metric', message: String(error) },
        { status: 500 }
      );
    }
  }
);
