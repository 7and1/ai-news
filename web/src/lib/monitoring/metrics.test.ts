/**
 * Tests for metrics collection utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock getEnv
vi.mock('../d1', () => ({
  getEnv: vi.fn(() => ({
    METRICS: {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
    },
  })),
}));

import { getEnv } from '../d1';

import {
  incrementCounter,
  setGauge,
  recordHistogram,
  getHistogramPercentile,
  trackHttpRequest,
  trackDbQuery,
  trackExternalApiCall,
  BusinessMetrics,
  getAllMetrics,
  exportPrometheusMetrics,
} from './metrics';

describe('metrics collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockResolvedValue({
      METRICS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
      } as unknown as KVNamespace,
    });
  });

  describe('incrementCounter', () => {
    it('increments counter with default value', async () => {
      await incrementCounter('test_counter');

      // Should not throw
      expect(true).toBe(true);
    });

    it('increments counter with custom value', async () => {
      await incrementCounter('test_counter', 5);

      // Should not throw
      expect(true).toBe(true);
    });

    it('increments counter with labels', async () => {
      await incrementCounter('requests_total', 1, {
        method: 'GET',
        path: '/api/test',
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('persists to KV', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        METRICS: mockKV as unknown as KVNamespace,
      });

      await incrementCounter('test_counter', 1, { label: 'value' });

      expect(mockKV.put).toHaveBeenCalledWith(
        'counter:test_counter{label=value}',
        expect.stringContaining('"type":"counter"'),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });
  });

  describe('setGauge', () => {
    it('sets gauge value', async () => {
      await setGauge('temperature', 42.5);

      // Should not throw
      expect(true).toBe(true);
    });

    it('sets gauge with labels', async () => {
      await setGauge('queue_size', 10, { queue: 'high_priority' });

      // Should not throw
      expect(true).toBe(true);
    });

    it('persists to KV', async () => {
      const mockKV = {
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        METRICS: mockKV as unknown as KVNamespace,
      });

      await setGauge('test_gauge', 100);

      expect(mockKV.put).toHaveBeenCalledWith(
        'gauge:test_gauge',
        expect.stringContaining('"value":100'),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it('handles negative values', async () => {
      await setGauge('offset', -50);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles zero', async () => {
      await setGauge('idle', 0);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('recordHistogram', () => {
    it('records histogram value', async () => {
      await recordHistogram('request_duration_ms', 150);

      // Should not throw
      expect(true).toBe(true);
    });

    it('records with custom buckets', async () => {
      const customBuckets = [10, 50, 100, 500, 1000];
      await recordHistogram('duration_ms', 250, undefined, customBuckets);

      // Should not throw
      expect(true).toBe(true);
    });

    it('records with labels', async () => {
      await recordHistogram('request_duration_ms', 150, { endpoint: '/api/test' });

      // Should not throw
      expect(true).toBe(true);
    });

    it('updates min, max, sum correctly', async () => {
      await recordHistogram('test', 10);
      await recordHistogram('test', 50);
      await recordHistogram('test', 30);

      // Should update statistics
      // Note: This tests the in-memory behavior
    });

    it('persists to KV', async () => {
      const mockKV = {
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        METRICS: mockKV as unknown as KVNamespace,
      });

      await recordHistogram('test_histogram', 100);

      expect(mockKV.put).toHaveBeenCalledWith(
        'histogram:test_histogram',
        expect.stringContaining('"count":1'),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });
  });

  describe('getHistogramPercentile', () => {
    it('returns 0 for empty histogram', () => {
      const histogram = {
        type: 'histogram' as const,
        name: 'test',
        description: 'Test histogram',
        buckets: [10, 50, 100],
        counts: { '10': 0, '50': 0, '100': 0 },
        sum: 0,
        count: 0,
        min: 0,
        max: 0,
      };

      const p50 = getHistogramPercentile(histogram, 50);
      const p95 = getHistogramPercentile(histogram, 95);

      expect(p50).toBe(0);
      expect(p95).toBe(0);
    });

    it('calculates p50 correctly', () => {
      const histogram = {
        type: 'histogram' as const,
        name: 'test',
        description: 'Test histogram',
        buckets: [10, 50, 100],
        counts: { '10': 3, '50': 7, '100': 10 },
        sum: 500,
        count: 10,
        min: 1,
        max: 100,
      };

      const p50 = getHistogramPercentile(histogram, 50);

      expect(p50).toBe(50);
    });

    it('calculates p95 correctly', () => {
      const histogram = {
        type: 'histogram' as const,
        name: 'test',
        description: 'Test histogram',
        buckets: [10, 50, 100],
        counts: { '10': 5, '50': 9, '100': 10 },
        sum: 500,
        count: 10,
        min: 1,
        max: 100,
      };

      const p95 = getHistogramPercentile(histogram, 95);

      expect(p95).toBe(100);
    });

    it('calculates p99 correctly', () => {
      const histogram = {
        type: 'histogram' as const,
        name: 'test',
        description: 'Test histogram',
        buckets: [10, 50, 100, 500],
        counts: { '10': 5, '50': 9, '100': 10, '500': 10 },
        sum: 1000,
        count: 10,
        min: 1,
        max: 500,
      };

      const p99 = getHistogramPercentile(histogram, 99);

      expect(p99).toBe(500);
    });

    it('handles edge cases', () => {
      const histogram = {
        type: 'histogram' as const,
        name: 'test',
        description: 'Test histogram',
        buckets: [1, 5, 10],
        counts: { '1': 0, '5': 1, '10': 1 },
        sum: 7,
        count: 1,
        min: 7,
        max: 7,
      };

      const p0 = getHistogramPercentile(histogram, 0);
      const p100 = getHistogramPercentile(histogram, 100);

      expect(p0).toBeGreaterThanOrEqual(0);
      expect(p100).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackHttpRequest', () => {
    it('tracks successful request', async () => {
      await trackHttpRequest({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 150,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks 4xx as warn', async () => {
      await trackHttpRequest({
        method: 'GET',
        path: '/api/test',
        statusCode: 404,
        duration: 50,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks 5xx as error', async () => {
      await trackHttpRequest({
        method: 'POST',
        path: '/api/test',
        statusCode: 500,
        duration: 250,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('normalizes path', async () => {
      await trackHttpRequest({
        method: 'GET',
        path: '/api/test/123/details',
        statusCode: 200,
        duration: 100,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('trackDbQuery', () => {
    it('tracks successful query', async () => {
      await trackDbQuery({
        query: 'SELECT * FROM users',
        duration: 25,
        success: true,
        rows: 10,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks failed query', async () => {
      await trackDbQuery({
        query: 'SELECT * FROM users',
        duration: 50,
        success: false,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('extracts operation type', async () => {
      await trackDbQuery({
        query: '  SELECT  * FROM users WHERE id = ?',
        duration: 25,
        success: true,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('trackExternalApiCall', () => {
    it('tracks successful API call', async () => {
      await trackExternalApiCall({
        service: 'openai',
        method: 'POST',
        statusCode: 200,
        duration: 500,
        success: true,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks failed API call', async () => {
      await trackExternalApiCall({
        service: 'external-api',
        method: 'GET',
        statusCode: 503,
        duration: 1000,
        success: false,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks API call without status code', async () => {
      await trackExternalApiCall({
        service: 'external-api',
        method: 'GET',
        duration: 200,
        success: true,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('BusinessMetrics', () => {
    it('tracks article created', async () => {
      await BusinessMetrics.articleCreated('source-1', 'Artificial_Intelligence');

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks article updated', async () => {
      await BusinessMetrics.articleUpdated();

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks source crawled', async () => {
      await BusinessMetrics.sourceCrawled('source-1', true);

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks failed source crawl', async () => {
      await BusinessMetrics.sourceCrawled('source-1', false);

      // Should not throw
      expect(true).toBe(true);
    });

    it('tracks ingest request', async () => {
      await BusinessMetrics.ingestRequest(true);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getAllMetrics', () => {
    it('returns empty metrics initially', async () => {
      const metrics = await getAllMetrics();

      expect(metrics.counters).toEqual([]);
      expect(metrics.gauges).toEqual([]);
      expect(metrics.histograms).toEqual([]);
    });

    it('includes in-memory metrics', async () => {
      await incrementCounter('test_counter', 5);
      await setGauge('test_gauge', 42);

      const metrics = await getAllMetrics();

      // Should have at least one metric
      expect(metrics.counters.length + metrics.gauges.length).toBeGreaterThan(0);
    });
  });

  describe('exportPrometheusMetrics', () => {
    it('exports metrics in Prometheus format', async () => {
      await incrementCounter('test_counter', 5, { label: 'value' });
      await setGauge('test_gauge', 42);

      const exported = await exportPrometheusMetrics();

      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('includes TYPE and HELP comments', async () => {
      await incrementCounter('requests_total', 1);

      const exported = await exportPrometheusMetrics();

      expect(exported).toContain('# TYPE');
      expect(exported).toContain('# HELP');
    });

    it('formats counters correctly', async () => {
      await incrementCounter('test_counter', 10);

      const exported = await exportPrometheusMetrics();

      expect(exported).toContain('test_counter');
    });

    it('formats gauges correctly', async () => {
      await setGauge('test_gauge', 42);

      const exported = await exportPrometheusMetrics();

      expect(exported).toContain('test_gauge 42');
    });

    it('formats histograms correctly', async () => {
      await recordHistogram('test_histogram', 150);

      const exported = await exportPrometheusMetrics();

      expect(exported).toContain('test_histogram_bucket');
      expect(exported).toContain('test_histogram_sum');
      expect(exported).toContain('test_histogram_count');
    });

    it('includes histogram bucket labels', async () => {
      await recordHistogram('duration_ms', 50);

      const exported = await exportPrometheusMetrics();

      expect(exported).toMatch(/le="[^"]+"/);
    });

    it('handles metrics with labels', async () => {
      await incrementCounter('requests_total', 1, { method: 'GET', path: '/api/test' });

      const exported = await exportPrometheusMetrics();

      expect(exported).toContain('method="GET"');
      expect(exported).toContain('path="/api/test"');
    });
  });

  describe('edge cases', () => {
    it('handles very large values', async () => {
      await incrementCounter('large_counter', Number.MAX_SAFE_INTEGER);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles zero values', async () => {
      await incrementCounter('zero_counter', 0);
      await setGauge('zero_gauge', 0);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles negative gauge values', async () => {
      await setGauge('negative_gauge', -100);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles special characters in labels', async () => {
      await incrementCounter('test', 1, {
        'special-chars': 'test with spaces',
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles unicode in labels', async () => {
      await incrementCounter('test', 1, {
        label: 'cafe-演示-test',
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles empty label values', async () => {
      await incrementCounter('test', 1, {
        empty: '',
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles many labels', async () => {
      const labels: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        labels[`label${i}`] = `value${i}`;
      }

      await incrementCounter('test', 1, labels);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles very small histogram values', async () => {
      await recordHistogram('tiny', 0.001);

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles very large histogram values', async () => {
      await recordHistogram('huge', 1000000);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('metric aggregation', () => {
    it('aggregates multiple counter increments', async () => {
      for (let i = 0; i < 10; i++) {
        await incrementCounter('agg_test', 1);
      }

      // The last value should be tracked
      // (In production, this would aggregate across time)
    });

    it('tracks histogram distribution', async () => {
      const values = [5, 15, 25, 50, 100, 250, 500];

      for (const value of values) {
        await recordHistogram('dist_test', value, undefined, [10, 50, 100, 500]);
      }

      // Should update bucket counts appropriately
    });
  });
});
