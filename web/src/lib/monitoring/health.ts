// Health check system for BestBlogs.dev
import { getEnv, getDb } from '@/lib/d1';

import { logger } from './logger';
import type { HealthCheck, HealthCheckResult } from './types';

/**
 * Check database connectivity
 */
export async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const db = await getDb();
    const result = await db.prepare('SELECT 1 AS test').first();

    const duration = Date.now() - startTime;

    if (result && (result as Record<string, unknown>).test === 1) {
      return {
        status: 'pass',
        name: 'database',
        description: 'D1 database is responding',
        duration,
      };
    }

    return {
      status: 'fail',
      name: 'database',
      description: 'Database returned unexpected result',
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.error('Database health check failed', { error }).catch(() => {});

    return {
      status: 'fail',
      name: 'database',
      description: error instanceof Error ? error.message : 'Unknown database error',
      duration,
    };
  }
}

/**
 * Check KV storage connectivity
 */
export async function checkKV(bindingName: string): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const env = await getEnv();
    const kv = env[bindingName as keyof CloudflareEnv];

    if (!kv || typeof kv.get !== 'function') {
      return {
        status: 'warn',
        name: bindingName.toLowerCase(),
        description: 'KV binding not configured',
        duration: Date.now() - startTime,
      };
    }

    // Test read/write
    const testKey = 'health_check_test_' + Date.now();
    await (kv as { put: (key: string, value: string) => Promise<void> }).put(testKey, 'ok');
    await (kv as { get: (key: string) => Promise<string | null> }).get(testKey);
    await (kv as { delete: (key: string) => Promise<void> }).delete(testKey);

    return {
      status: 'pass',
      name: bindingName.toLowerCase(),
      description: 'KV storage is responding',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      status: 'warn',
      name: bindingName.toLowerCase(),
      description: error instanceof Error ? error.message : 'KV check failed',
      duration,
    };
  }
}

/**
 * Check R2 bucket connectivity
 */
export async function checkR2(bindingName: string = 'R2'): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const env = await getEnv();
    const r2 = env[bindingName as keyof CloudflareEnv];

    if (!r2 || typeof r2.list !== 'function') {
      return {
        status: 'warn',
        name: bindingName.toLowerCase(),
        description: 'R2 binding not configured',
        duration: Date.now() - startTime,
      };
    }

    // Test list operation (should be cheap)
    await (r2 as { list: () => Promise<{ objects: unknown[] }> }).list();

    return {
      status: 'pass',
      name: bindingName.toLowerCase(),
      description: 'R2 storage is responding',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      status: 'warn',
      name: bindingName.toLowerCase(),
      description: error instanceof Error ? error.message : 'R2 check failed',
      duration,
    };
  }
}

/**
 * Check external service availability
 */
export async function checkExternalService(
  name: string,
  url: string,
  timeout: number = 5000
): Promise<HealthCheck> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      status: response.ok ? 'pass' : 'degraded',
      name: name.toLowerCase(),
      description: 'Service responded with status ' + response.status,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    return {
      status: 'fail',
      name: name.toLowerCase(),
      description: error instanceof Error ? error.message : 'Service check failed',
      duration,
    };
  }
}

/**
 * Get basic system info
 */
export async function getSystemInfo(): Promise<HealthCheck> {
  return {
    status: 'pass',
    name: 'system',
    description: 'Worker runtime is active',
    observedValue: Date.now(),
    observedUnit: 'timestamp',
  };
}

/**
 * Comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const checks: Record<string, HealthCheck> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check database (critical)
  checks.database = await checkDatabase();

  // Check KV storage (optional)
  checks.logs = await checkKV('LOGS');
  checks.metrics = await checkKV('METRICS');
  checks.error_tracking = await checkKV('ERROR_TRACKING');

  // Check R2 (optional)
  checks.r2 = await checkR2('R2');
  checks.r2_cache = await checkR2('NEXT_INC_CACHE_R2_BUCKET');

  // System info
  checks.system = await getSystemInfo();

  // Determine overall status
  const criticalFailures = Object.values(checks).filter(
    (c) => c.name === 'database' && c.status === 'fail'
  ).length;

  const warnings = Object.values(checks).filter(
    (c) => c.status === 'warn' || c.status === 'degraded'
  ).length;

  if (criticalFailures > 0) {
    overallStatus = 'unhealthy';
  } else if (warnings > 0) {
    overallStatus = 'degraded';
  }

  await logger
    .info('Health check completed', {
      status: overallStatus,
      checks: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.status])),
    })
    .catch(() => {});

  return {
    status: overallStatus,
    timestamp: Date.now(),
    checks,
  };
}

/**
 * Simple liveness check - is the worker running?
 */
export async function livenessCheck(): Promise<{ ok: boolean }> {
  return { ok: true };
}

/**
 * Readiness check - can the worker handle requests?
 */
export async function readinessCheck(): Promise<{
  ready: boolean;
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {};

  // Database is required
  try {
    const db = await getDb();
    await db.prepare('SELECT 1').first();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every((v) => v);

  return { ready, checks };
}
