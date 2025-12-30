// Alerting system for BestBlogs.dev
import { getEnv } from '@/lib/d1';

import { logger } from './logger';
import type { AlertCondition, AlertEvent } from './types';

/**
 * Default alert conditions
 */
export const DEFAULT_ALERT_CONDITIONS: AlertCondition[] = [
  {
    id: 'high_error_rate',
    name: 'High Error Rate',
    description: 'Error rate exceeds 5% over 5 minutes',
    enabled: true,
    type: 'error_rate',
    threshold: 0.05, // 5%
    windowSeconds: 300,
    notificationChannels: ['webhook'],
    triggerCount: 0,
  },
  {
    id: 'high_response_time',
    name: 'High Response Time',
    description: 'P95 response time exceeds 2 seconds',
    enabled: true,
    type: 'response_time',
    threshold: 2000, // 2 seconds
    windowSeconds: 300,
    notificationChannels: ['webhook'],
    triggerCount: 0,
  },
  {
    id: 'error_count_spike',
    name: 'Error Count Spike',
    description: 'More than 10 errors in 1 minute',
    enabled: true,
    type: 'error_count',
    threshold: 10,
    windowSeconds: 60,
    notificationChannels: ['webhook'],
    triggerCount: 0,
  },
  {
    id: 'database_errors',
    name: 'Database Errors',
    description: 'Database error rate exceeds 1%',
    enabled: true,
    type: 'metric_threshold',
    threshold: 0.01,
    windowSeconds: 300,
    notificationChannels: ['webhook'],
    triggerCount: 0,
  },
];

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return 'alert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Send alert webhook notification
 */
async function sendWebhookAlert(event: AlertEvent): Promise<boolean> {
  try {
    const env = await getEnv();
    const webhookUrl = env.ALERT_WEBHOOK_URL;

    if (!webhookUrl) {
      await logger.warn('No webhook URL configured for alerts').catch(() => {});
      return false;
    }

    const payload = {
      alert_id: event.id,
      condition: event.conditionName,
      severity: event.severity,
      message: event.message,
      timestamp: event.timestamp,
      data: event.data,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BestBlogs.dev-Alerting/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      await logger.info('Alert webhook sent successfully', { alertId: event.id }).catch(() => {});
      return true;
    } else {
      await logger
        .warn('Alert webhook failed', {
          status: response.status,
          alertId: event.id,
        })
        .catch(() => {});
      return false;
    }
  } catch (error) {
    await logger.error('Failed to send alert webhook', { error }).catch(() => {});
    return false;
  }
}

/**
 * Create and trigger an alert
 */
export async function triggerAlert(
  condition: AlertCondition,
  severity: 'info' | 'warning' | 'critical',
  message: string,
  data: Record<string, unknown>
): Promise<AlertEvent> {
  const event: AlertEvent = {
    id: generateAlertId(),
    conditionId: condition.id,
    conditionName: condition.name,
    severity,
    message,
    timestamp: Date.now(),
    resolved: false,
    data,
  };

  // Store alert event
  try {
    const env = await getEnv();
    if (env.METRICS) {
      const alertKey = 'alert:' + event.id;
      await env.METRICS.put(alertKey, JSON.stringify(event), {
        expirationTtl: 30 * 24 * 60 * 60, // 30 days
      });

      // Update alert condition
      condition.lastTriggered = event.timestamp;
      condition.triggerCount++;

      const conditionKey = 'alert_condition:' + condition.id;
      await env.METRICS.put(conditionKey, JSON.stringify(condition), {
        expirationTtl: 90 * 24 * 60 * 60,
      });

      // Add to recent alerts index
      const indexKey = 'alerts:recent';
      const index = await env.METRICS.get(indexKey, 'json');
      const alertIds = index && typeof index === 'object' ? (index as string[]) : [];
      alertIds.unshift(event.id);
      await env.METRICS.put(
        indexKey,
        JSON.stringify(alertIds.slice(0, 100)), // Keep last 100
        { expirationTtl: 7 * 24 * 60 * 60 }
      );
    }
  } catch (error) {
    await logger.error('Failed to store alert', { error }).catch(() => {});
  }

  // Send notifications
  if (condition.notificationChannels.includes('webhook')) {
    await sendWebhookAlert(event);
  }

  // Log the alert
  const logLevel = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'info';
  await logger[logLevel]('ALERT: ' + message, { event }).catch(() => {});

  return event;
}

/**
 * Check if an alert condition should trigger
 */
export async function evaluateAlertCondition(
  condition: AlertCondition
): Promise<{ shouldTrigger: boolean; currentValue: number }> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return { shouldTrigger: false, currentValue: 0 };
    }

    const now = Date.now();
    const windowStart = now - condition.windowSeconds * 1000;

    switch (condition.type) {
      case 'error_rate': {
        // Get total requests and errors in the window
        const requestsKey = 'counter:http_requests_total';
        const errorsKey = 'counter:http_errors_total';

        // This is a simplified check - in production, you'd aggregate time-series data
        const recentErrors = await getRecentMetricCount(errorsKey, windowStart);
        const recentRequests = await getRecentMetricCount(requestsKey, windowStart);

        const errorRate = recentRequests > 0 ? recentErrors / recentRequests : 0;

        return {
          shouldTrigger: errorRate > condition.threshold,
          currentValue: errorRate,
        };
      }

      case 'response_time': {
        // Check P95 response time
        const histKey = 'histogram:http_request_duration_ms';
        const histogram = await env.METRICS.get(histKey, 'json');

        if (histogram && typeof histogram === 'object') {
          const hist = histogram as { sum: number; count: number };
          const avgResponseTime = hist.count > 0 ? hist.sum / hist.count : 0;

          return {
            shouldTrigger: avgResponseTime > condition.threshold,
            currentValue: avgResponseTime,
          };
        }

        return { shouldTrigger: false, currentValue: 0 };
      }

      case 'error_count': {
        // Count recent errors
        const errorsKey = 'counter:http_errors_total';
        const errorCount = await getRecentMetricCount(errorsKey, windowStart);

        return {
          shouldTrigger: errorCount > condition.threshold,
          currentValue: errorCount,
        };
      }

      case 'metric_threshold': {
        // Generic metric threshold check
        // This would be customized based on the specific metric
        return { shouldTrigger: false, currentValue: 0 };
      }

      default:
        return { shouldTrigger: false, currentValue: 0 };
    }
  } catch (error) {
    await logger.error('Failed to evaluate alert condition', { error, condition }).catch(() => {});
    return { shouldTrigger: false, currentValue: 0 };
  }
}

/**
 * Get recent metric count from a counter
 */
async function getRecentMetricCount(metricKey: string, since: number): Promise<number> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return 0;
    }

    const data = await env.METRICS.get(metricKey, 'json');
    if (!data || typeof data !== 'object') {
      return 0;
    }

    const counter = data as {
      values: Array<{ timestamp: number; value: number }>;
    };

    return counter.values.filter((v) => v.timestamp >= since).reduce((sum, v) => sum + v.value, 0);
  } catch {
    return 0;
  }
}

/**
 * Get all alert conditions
 */
export async function getAlertConditions(): Promise<AlertCondition[]> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return DEFAULT_ALERT_CONDITIONS;
    }

    const keys = await env.METRICS.list({ prefix: 'alert_condition:' });
    const conditions: AlertCondition[] = [...DEFAULT_ALERT_CONDITIONS];

    for (const key of keys.keys) {
      const data = await env.METRICS.get(key.name, 'json');
      if (data && typeof data === 'object') {
        const index = conditions.findIndex((c) => c.id === (data as AlertCondition).id);
        if (index >= 0) {
          conditions[index] = data as AlertCondition;
        } else {
          conditions.push(data as AlertCondition);
        }
      }
    }

    return conditions;
  } catch {
    return DEFAULT_ALERT_CONDITIONS;
  }
}

/**
 * Get recent alert events
 */
export async function getRecentAlerts(limit: number = 50): Promise<AlertEvent[]> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return [];
    }

    const indexKey = 'alerts:recent';
    const index = await env.METRICS.get(indexKey, 'json');
    const alertIds = index && typeof index === 'object' ? (index as string[]) : [];

    const alerts: AlertEvent[] = [];

    for (const id of alertIds.slice(0, limit)) {
      const data = await env.METRICS.get('alert:' + id, 'json');
      if (data && typeof data === 'object') {
        alerts.push(data as AlertEvent);
      }
    }

    return alerts;
  } catch {
    return [];
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<boolean> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return false;
    }

    const data = await env.METRICS.get('alert:' + alertId, 'json');
    if (!data || typeof data !== 'object') {
      return false;
    }

    const alert = data as AlertEvent;
    alert.resolved = true;
    alert.resolvedAt = Date.now();

    await env.METRICS.put('alert:' + alertId, JSON.stringify(alert), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    await logger.info('Alert resolved', { alertId }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Update an alert condition
 */
export async function updateAlertCondition(condition: AlertCondition): Promise<boolean> {
  try {
    const env = await getEnv();
    if (!env.METRICS) {
      return false;
    }

    const key = 'alert_condition:' + condition.id;
    await env.METRICS.put(key, JSON.stringify(condition), {
      expirationTtl: 90 * 24 * 60 * 60,
    });

    await logger.info('Alert condition updated', { conditionId: condition.id }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluate all enabled alert conditions
 */
export async function evaluateAllAlerts(): Promise<void> {
  const conditions = await getAlertConditions();
  const enabledConditions = conditions.filter((c) => c.enabled);

  for (const condition of enabledConditions) {
    try {
      const { shouldTrigger, currentValue } = await evaluateAlertCondition(condition);

      if (shouldTrigger) {
        // Check if we haven't triggered recently (debounce)
        const cooldownMs = 5 * 60 * 1000; // 5 minutes
        const lastTriggered = condition.lastTriggered || 0;

        if (Date.now() - lastTriggered > cooldownMs) {
          await triggerAlert(
            condition,
            condition.threshold > currentValue * 2 ? 'critical' : 'warning',
            condition.name + ' threshold exceeded',
            {
              conditionId: condition.id,
              threshold: condition.threshold,
              currentValue,
              windowSeconds: condition.windowSeconds,
            }
          );
        }
      }
    } catch (error) {
      await logger.error('Failed to evaluate alert', { error, condition }).catch(() => {});
    }
  }
}
