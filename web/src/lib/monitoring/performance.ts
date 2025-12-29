// Performance monitoring utility for BestBlogs.dev
import { logger } from './logger';
import { trackDbQuery, trackExternalApiCall, recordHistogram } from './metrics';
import type { PerformanceMetric } from './types';

/**
 * Measure the execution time of an async function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<{ result: T; metric: PerformanceMetric }> {
  const startTime = Date.now();
  let result: T;

  try {
    result = await fn();
    return { result, metric: createMetric(name, startTime, true, metadata) };
  } catch (error) {
    const metric = createMetric(name, startTime, false, metadata);
    void logger.error('Performance measurement failed: ' + name, { error, metric }).catch(() => {});
    throw error;
  }
}

/**
 * Create a performance metric
 */
function createMetric(
  name: string,
  startTime: number,
  success: boolean,
  metadata?: Record<string, unknown>
): PerformanceMetric {
  const duration = Date.now() - startTime;
  return {
    name,
    duration,
    timestamp: startTime,
    success,
    metadata,
  };
}

/**
 * Track a database query with performance monitoring
 */
export async function trackQuery<T>(
  query: string,
  params: unknown[],
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let result: T;
  let success = true;
  let rowsAffected: number | undefined;

  try {
    result = await fn();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    // Log slow queries
    if (duration > 1000) {
      void logger.warn('Slow database query detected', {
        query: query.substring(0, 200),
        duration,
        params: params?.length,
      }).catch(() => {});
    }

    await trackDbQuery({
      query,
      duration,
      success,
      rows: rowsAffected,
    });
  }
}

/**
 * Track an external API call with performance monitoring
 */
export async function trackExternalCall<T>(
  service: string,
  method: string,
  url: string,
  fn: () => Promise<{ status?: number; data: T }>
): Promise<T> {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let success = true;

  try {
    const response = await fn();
    statusCode = response.status;
    return response.data;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;

    await trackExternalApiCall({
      service,
      method,
      statusCode,
      duration,
      success,
    });
  }
}

/**
 * Wrapper for fetch with performance tracking
 */
export async function trackedFetch(
  service: string,
  url: string,
  options?: RequestInit
): Promise<Response> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, options);

    await trackExternalApiCall({
      service,
      method: options?.method || 'GET',
      statusCode: response.status,
      duration: Date.now() - startTime,
      success: response.ok,
    });

    return response;
  } catch (error) {
    await trackExternalApiCall({
      service,
      method: options?.method || 'GET',
      duration: Date.now() - startTime,
      success: false,
    });
    throw error;
  }
}

/**
 * Performance monitoring context for timing multiple operations
 */
export class PerformanceTimer {
  private readonly name: string;
  private readonly startTime: number;
  private readonly measurements: Map<string, number> = new Map();
  private readonly labels: Record<string, string>;

  constructor(name: string, labels?: Record<string, string>) {
    this.name = name;
    this.startTime = Date.now();
    this.labels = labels || {};
  }

  /**
   * Record a checkpoint time
   */
  checkpoint(name: string): void {
    this.measurements.set(name, Date.now() - this.startTime);
  }

  /**
   * Time a specific operation
   */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.checkpoint(name);
      const duration = Date.now() - start;
      void recordHistogram('operation_duration_ms', duration, {
        ...this.labels,
        operation: name,
      }).catch(() => {});
    }
  }

  /**
   * Get all measurements
   */
  getMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  /**
   * Get total elapsed time
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Finish and record the total duration
   */
  async finish(): Promise<void> {
    const total = this.getElapsed();
    await recordHistogram('request_duration_ms', total, this.labels);

    void logger.debug('Performance timer finished', {
      name: this.name,
      total,
      measurements: this.getMeasurements(),
    }).catch(() => {});
  }
}

/**
 * Create a new performance timer
 */
export function createTimer(name: string, labels?: Record<string, string>): PerformanceTimer {
  return new PerformanceTimer(name, labels);
}

/**
 * Middleware timing helper
 */
export function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  labels?: Record<string, string>
): Promise<T> {
  const timer = createTimer(name, labels);

  return timer.time(name, fn).finally(() => {
    timer.finish().catch(() => {
      // Silently fail
    });
  });
}
