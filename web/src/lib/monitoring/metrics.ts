// Metrics collection utility for BestBlogs.dev
import { getEnv } from '@/lib/d1';

import type { Metric, CounterMetric, GaugeMetric, HistogramMetric } from './types';

// Default histogram buckets for response times in milliseconds
const DEFAULT_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const metricsCacheByNamespace = new WeakMap<object, Map<string, Metric>>();
const fallbackMetricsCache = new Map<string, Metric>();

async function getMetricsCache(): Promise<Map<string, Metric>> {
  try {
    const env = await getEnv();
    const metrics = env.METRICS as unknown as object | undefined;
    if (!metrics || typeof metrics !== 'object') {
      return fallbackMetricsCache;
    }
    const existing = metricsCacheByNamespace.get(metrics);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Metric>();
    metricsCacheByNamespace.set(metrics, created);
    return created;
  } catch {
    return fallbackMetricsCache;
  }
}

/**
 * Generate a metric key
 */
function metricKey(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return name;
  }
  const labelStr = Object.entries(labels)
    .map(([k, v]) => k + '=' + v)
    .join(',');
  return name + '{' + labelStr + '}';
}

/**
 * Increment a counter metric
 */
export async function incrementCounter(
  name: string,
  value: number = 1,
  labels?: Record<string, string>
): Promise<void> {
  const metricsCache = await getMetricsCache();
  const key = metricKey(name, labels);
  const timestamp = Date.now();

  let metric = metricsCache.get(key) as CounterMetric | undefined;

  if (!metric) {
    metric = {
      type: 'counter',
      name,
      description: name,
      values: [],
      labels,
    };
    metricsCache.set(key, metric);
  }

  metric.values.push({ value, timestamp, labels });

  // Persist to KV
  try {
    const env = await getEnv();
    if (env.METRICS) {
      const counterKey = 'counter:' + key;
      const existing = await env.METRICS.get(counterKey, 'json');
      const existingValues =
        existing && typeof existing === 'object' ? (existing as CounterMetric).values : [];

      const newValue = { value, timestamp, labels };
      await env.METRICS.put(
        counterKey,
        JSON.stringify({
          type: 'counter',
          name,
          description: name,
          values: [...existingValues, newValue].slice(-1000), // Keep last 1000
          labels,
        }),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    }
  } catch {
    // KV not available
  }
}

/**
 * Set a gauge metric
 */
export async function setGauge(
  name: string,
  value: number,
  labels?: Record<string, string>
): Promise<void> {
  const metricsCache = await getMetricsCache();
  const key = metricKey(name, labels);
  const timestamp = Date.now();

  const metric: GaugeMetric = {
    type: 'gauge',
    name,
    description: name,
    value,
    timestamp,
    labels,
  };

  metricsCache.set(key, metric);

  // Persist to KV
  try {
    const env = await getEnv();
    if (env.METRICS) {
      await env.METRICS.put('gauge:' + key, JSON.stringify(metric), {
        expirationTtl: 7 * 24 * 60 * 60,
      });
    }
  } catch {
    // KV not available
  }
}

/**
 * Record a value in a histogram
 */
export async function recordHistogram(
  name: string,
  value: number,
  labels?: Record<string, string>,
  customBuckets?: number[]
): Promise<void> {
  const metricsCache = await getMetricsCache();
  const key = metricKey(name, labels);
  const buckets = customBuckets || DEFAULT_BUCKETS;

  let metric = metricsCache.get(key) as HistogramMetric | undefined;

  if (!metric) {
    metric = {
      type: 'histogram',
      name,
      description: name,
      buckets,
      counts: {},
      sum: 0,
      count: 0,
      min: value,
      max: value,
      labels,
    };
    // Initialize counts
    for (const bucket of buckets) {
      metric.counts[bucket] = 0;
    }
    metricsCache.set(key, metric);
  }

  // Update histogram
  metric.count += 1;
  metric.sum += value;
  metric.min = Math.min(metric.min, value);
  metric.max = Math.max(metric.max, value);

  // Increment bucket counts
  for (const bucket of buckets) {
    if (value <= bucket) {
      metric.counts[bucket] = (metric.counts[bucket] || 0) + 1;
    }
  }

  // Persist to KV
  try {
    const env = await getEnv();
    if (env.METRICS) {
      await env.METRICS.put('histogram:' + key, JSON.stringify(metric), {
        expirationTtl: 7 * 24 * 60 * 60,
      });
    }
  } catch {
    // KV not available
  }
}

/**
 * Get percentile from histogram
 */
export function getHistogramPercentile(metric: HistogramMetric, percentile: number): number {
  if (metric.count === 0) {
    return 0;
  }

  const targetCount = Math.ceil((metric.count * percentile) / 100);

  for (const bucket of metric.buckets.slice().sort((a, b) => a - b)) {
    // `counts[bucket]` is cumulative (<= bucket) based on how we record histograms.
    if ((metric.counts[bucket] || 0) > targetCount) {
      return bucket;
    }
  }

  return metric.buckets[metric.buckets.length - 1] || metric.max;
}

/**
 * Track an HTTP request
 */
export async function trackHttpRequest(options: {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
}): Promise<void> {
  const { method, path, statusCode, duration } = options;
  const labels = {
    method,
    path: path.split('/').slice(0, 3).join('/'), // Normalize path
    status: String(Math.floor(statusCode / 100)) + 'xx',
  };

  await incrementCounter('http_requests_total', 1, labels);
  await recordHistogram('http_request_duration_ms', duration, labels);

  // Track errors separately
  if (statusCode >= 400) {
    await incrementCounter('http_errors_total', 1, {
      ...labels,
      status: String(statusCode),
    });
  }
}

/**
 * Track a database query
 */
export async function trackDbQuery(options: {
  query: string;
  duration: number;
  success: boolean;
  rows?: number;
}): Promise<void> {
  const { query, duration, success } = options;

  // Extract operation type from query
  const operation = query.trim().split(/\s+/)[0]?.toUpperCase() || 'UNKNOWN';

  await incrementCounter('db_queries_total', 1, {
    operation,
    success: String(success),
  });
  await recordHistogram('db_query_duration_ms', duration, { operation });

  if (!success) {
    await incrementCounter('db_errors_total', 1, { operation });
  }
}

/**
 * Track an external API call
 */
export async function trackExternalApiCall(options: {
  service: string;
  method: string;
  statusCode?: number;
  duration: number;
  success: boolean;
}): Promise<void> {
  const { service, method, statusCode, duration, success } = options;

  await incrementCounter('external_api_calls_total', 1, {
    service,
    method,
    success: String(success),
  });

  await recordHistogram('external_api_duration_ms', duration, { service });

  if (statusCode && statusCode >= 400) {
    await incrementCounter('external_api_errors_total', 1, {
      service,
      status: String(Math.floor(statusCode / 100)) + 'xx',
    });
  }
}

/**
 * Track business metrics
 */
export const BusinessMetrics = {
  async articleCreated(sourceId: string, category?: string): Promise<void> {
    await incrementCounter('articles_created_total', 1, {
      source: sourceId,
      category: category || 'unknown',
    });
  },

  async articleUpdated(): Promise<void> {
    await incrementCounter('articles_updated_total');
  },

  async sourceCrawled(sourceId: string, success: boolean): Promise<void> {
    await incrementCounter('source_crawls_total', 1, {
      source: sourceId,
      success: String(success),
    });
  },

  async ingestRequest(success: boolean): Promise<void> {
    await incrementCounter('ingest_requests_total', 1, {
      success: String(success),
    });
  },
};

/**
 * Get all metrics for export
 */
export async function getAllMetrics(): Promise<{
  counters: CounterMetric[];
  gauges: GaugeMetric[];
  histograms: HistogramMetric[];
}> {
  const metricsCache = await getMetricsCache();
  const result = {
    counters: [] as CounterMetric[],
    gauges: [] as GaugeMetric[],
    histograms: [] as HistogramMetric[],
  };

  // Get in-memory metrics
  for (const metric of metricsCache.values()) {
    if (metric.type === 'counter') {
      result.counters.push(metric);
    } else if (metric.type === 'gauge') {
      result.gauges.push(metric);
    } else if (metric.type === 'histogram') {
      result.histograms.push(metric);
    }
  }

  // Get persisted metrics from KV
  try {
    const env = await getEnv();
    if (env.METRICS) {
      const keys = await env.METRICS.list();

      for (const key of keys.keys) {
        const data = await env.METRICS.get(key.name, 'json');
        if (data && typeof data === 'object') {
          const metric = data as Metric;
          if (metric.type === 'counter') {
            result.counters.push(metric);
          } else if (metric.type === 'gauge') {
            result.gauges.push(metric);
          } else if (metric.type === 'histogram') {
            result.histograms.push(metric);
          }
        }
      }
    }
  } catch {
    // KV not available
  }

  return result;
}

/**
 * Export metrics in Prometheus format
 */
export async function exportPrometheusMetrics(): Promise<string> {
  const metrics = await getAllMetrics();
  const lines: string[] = [];

  // Counters
  const countersByName = new Map<string, CounterMetric[]>();
  for (const counter of metrics.counters) {
    const existing = countersByName.get(counter.name) || [];
    existing.push(counter);
    countersByName.set(counter.name, existing);
  }

  for (const [name, counters] of countersByName) {
    lines.push('# TYPE ' + name + ' counter');
    lines.push('# HELP ' + name + ' ' + counters[0]?.description || name);

    for (const counter of counters) {
      const sum = counter.values.reduce((acc, v) => acc + v.value, 0);
      const labelStr = counter.labels
        ? '{' +
          Object.entries(counter.labels)
            .map(([k, v]) => k + '="' + v + '"')
            .join(',') +
          '}'
        : '';
      lines.push(name + labelStr + ' ' + sum);
    }
    lines.push('');
  }

  // Gauges
  for (const gauge of metrics.gauges) {
    lines.push('# TYPE ' + gauge.name + ' gauge');
    lines.push('# HELP ' + gauge.name + ' ' + gauge.description);
    const labelStr = gauge.labels
      ? '{' +
        Object.entries(gauge.labels)
          .map(([k, v]) => k + '="' + v + '"')
          .join(',') +
        '}'
      : '';
    lines.push(gauge.name + labelStr + ' ' + gauge.value);
    lines.push('');
  }

  // Histograms
  const histogramsByName = new Map<string, HistogramMetric[]>();
  for (const hist of metrics.histograms) {
    const existing = histogramsByName.get(hist.name) || [];
    existing.push(hist);
    histogramsByName.set(hist.name, existing);
  }

  for (const [name, histograms] of histogramsByName) {
    const first = histograms[0]!;
    lines.push('# TYPE ' + name + ' histogram');
    lines.push('# HELP ' + name + ' ' + first.description);

    for (const hist of histograms) {
      const labelStr = hist.labels
        ? ',' +
          Object.entries(hist.labels)
            .map(([k, v]) => k + '="' + v + '"')
            .join(',')
        : '';

      for (const bucket of hist.buckets) {
        const count = hist.counts[bucket] || 0;
        lines.push(name + '_bucket{le="' + bucket + '"' + labelStr + '} ' + count);
      }
      lines.push(name + '_bucket{le="+Inf"' + labelStr + '} ' + hist.count);
      lines.push(name + '_sum' + (labelStr ? '{' + labelStr.substring(1) : '') + ' ' + hist.sum);
      lines.push(
        name + '_count' + (labelStr ? '{' + labelStr.substring(1) : '') + ' ' + hist.count
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
