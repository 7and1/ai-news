// Dashboard API for monitoring visualization
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddleware } from '@/lib/middleware';
import { getAllMetrics, getErrorStats, incrementCounter, logger } from '@/lib/monitoring';

/**
 * GET /api/admin/dashboard - Get dashboard data
 * Query params:
 *   - period: 1h | 24h | 7d | 30d (default: 24h)
 */
export const GET = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'dashboard',
    }).catch(() => {});

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';

    try {
      const [metrics, errorStats] = await Promise.all([getAllMetrics(), getErrorStats()]);

      // Calculate metrics for dashboard
      const dashboard = {
        timestamp: Date.now(),
        period,
        overview: {
          totalRequests: calculateTotalRequests(metrics),
          totalErrors: calculateTotalErrors(metrics),
          avgResponseTime: calculateAvgResponseTime(metrics),
          errorRate: calculateErrorRate(metrics),
          activeSources: calculateActiveSources(metrics),
        },
        endpoints: calculateEndpointMetrics(metrics),
        errors: {
          total: errorStats.total,
          unresolved: errorStats.unresolved,
          byType: errorStats.byType,
          top: errorStats.topErrors.slice(0, 5),
        },
        business: {
          articlesCreated: calculateArticlesCreated(metrics),
          articlesUpdated: calculateArticlesUpdated(metrics),
          sourceCrawls: calculateSourceCrawls(metrics),
          ingestRequests: calculateIngestRequests(metrics),
        },
        performance: {
          p50: calculatePercentile(metrics, 50),
          p95: calculatePercentile(metrics, 95),
          p99: calculatePercentile(metrics, 99),
        },
      };

      return NextResponse.json(dashboard);
    } catch (error) {
      await logger.error('Failed to fetch dashboard data', { error });
      return NextResponse.json(
        { error: 'failed_to_fetch_dashboard', message: String(error) },
        { status: 500 }
      );
    }
  }
);

function calculateTotalRequests(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const httpRequests = counters.find((c) => c.name === 'http_requests_total');
  return httpRequests?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculateTotalErrors(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const errors = counters.find((c) => c.name === 'http_errors_total');
  return errors?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculateAvgResponseTime(metrics: { histograms: unknown[] }): number {
  const histograms = metrics.histograms as Array<{
    name: string;
    sum: number;
    count: number;
  }>;
  const httpDuration = histograms.find((h) => h.name === 'http_request_duration_ms');
  return httpDuration && httpDuration.count > 0 ? httpDuration.sum / httpDuration.count : 0;
}

function calculateErrorRate(metrics: { counters: unknown[] }): number {
  const requests = calculateTotalRequests(metrics);
  const errors = calculateTotalErrors(metrics);
  return requests > 0 ? errors / requests : 0;
}

function calculateActiveSources(metrics: { gauges: unknown[] }): number {
  const gauges = metrics.gauges as Array<{ name: string; value: number }>;
  const activeSources = gauges.find((g) => g.name === 'sources_active');
  return activeSources?.value || 0;
}

function calculateEndpointMetrics(metrics: { counters: unknown[]; histograms: unknown[] }): Array<{
  path: string;
  method: string;
  requests: number;
  errors: number;
  avgDuration: number;
}> {
  const counters = metrics.counters as Array<{
    name: string;
    labels?: Record<string, string>;
    values: Array<{ value: number }>;
  }>;
  const histograms = metrics.histograms as Array<{
    name: string;
    labels?: Record<string, string>;
    sum: number;
    count: number;
  }>;

  const endpointMap = new Map<
    string,
    {
      path: string;
      method: string;
      requests: number;
      errors: number;
      sumDuration: number;
      count: number;
    }
  >();

  for (const counter of counters) {
    if (counter.name === 'http_requests_total' && counter.labels) {
      const method = counter.labels.method ?? 'unknown';
      const path = counter.labels.path ?? 'unknown';
      const key = method + ':' + path;
      const value = counter.values.reduce((sum, v) => sum + v.value, 0);

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          path,
          method,
          requests: 0,
          errors: 0,
          sumDuration: 0,
          count: 0,
        });
      }

      const endpoint = endpointMap.get(key);
      if (!endpoint) {
        continue;
      }
      endpoint.requests += value;
    }

    if (counter.name === 'http_errors_total' && counter.labels) {
      const method = counter.labels.method ?? 'unknown';
      const path = counter.labels.path ?? 'unknown';
      const key = method + ':' + path;
      const value = counter.values.reduce((sum, v) => sum + v.value, 0);

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          path,
          method,
          requests: 0,
          errors: 0,
          sumDuration: 0,
          count: 0,
        });
      }

      const endpoint = endpointMap.get(key);
      if (!endpoint) {
        continue;
      }
      endpoint.errors += value;
    }
  }

  for (const hist of histograms) {
    if (hist.name === 'http_request_duration_ms' && hist.labels) {
      const method = hist.labels.method ?? 'unknown';
      const path = hist.labels.path ?? 'unknown';
      const key = method + ':' + path;

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          path,
          method,
          requests: 0,
          errors: 0,
          sumDuration: 0,
          count: 0,
        });
      }

      const endpoint = endpointMap.get(key);
      if (!endpoint) {
        continue;
      }
      endpoint.sumDuration += hist.sum;
      endpoint.count += hist.count;
    }
  }

  return Array.from(endpointMap.values()).map((e) => ({
    path: e.path,
    method: e.method,
    requests: e.requests,
    errors: e.errors,
    avgDuration: e.count > 0 ? e.sumDuration / e.count : 0,
  }));
}

function calculateArticlesCreated(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const articles = counters.find((c) => c.name === 'articles_created_total');
  return articles?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculateArticlesUpdated(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const articles = counters.find((c) => c.name === 'articles_updated_total');
  return articles?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculateSourceCrawls(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const crawls = counters.find((c) => c.name === 'source_crawls_total');
  return crawls?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculateIngestRequests(metrics: { counters: unknown[] }): number {
  const counters = metrics.counters as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
  const ingest = counters.find((c) => c.name === 'ingest_requests_total');
  return ingest?.values.reduce((sum, v) => sum + v.value, 0) || 0;
}

function calculatePercentile(metrics: { histograms: unknown[] }, percentile: number): number {
  const histograms = metrics.histograms as Array<{
    name: string;
    buckets?: number[];
    counts?: Record<number, number>;
    count: number;
  }>;

  const httpDuration = histograms.find((h) => h.name === 'http_request_duration_ms');
  if (!httpDuration || !httpDuration.buckets || !httpDuration.counts || httpDuration.count === 0) {
    return 0;
  }

  const targetCount = (httpDuration.count * percentile) / 100;
  let cumulativeCount = 0;

  for (const bucket of [...httpDuration.buckets].sort((a, b) => a - b)) {
    cumulativeCount += httpDuration.counts[bucket] || 0;
    if (cumulativeCount >= targetCount) {
      return bucket;
    }
  }

  return httpDuration.buckets[httpDuration.buckets.length - 1] || 0;
}
