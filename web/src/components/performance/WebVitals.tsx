'use client';

import { useEffect } from 'react';
import { type Metric, onCLS, onFID, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

// Thresholds for "good" performance based on Web Vitals
const VITAL_THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FID: { good: 100, needsImprovement: 300 },
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
  INP: { good: 200, needsImprovement: 500 },
};

type WebVitalsReporter = {
  report?: boolean;
  endpoint?: string;
  analyticsId?: string;
};

/**
 * Get performance rating based on threshold
 */
function getRating(
  metricName: keyof typeof VITAL_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = VITAL_THRESHOLDS[metricName];
  if (value <= thresholds.good) {return 'good';}
  if (value <= thresholds.needsImprovement) {return 'needs-improvement';}
  return 'poor';
}

/**
 * Send metrics to analytics endpoint
 */
async function sendToAnalytics(metric: Metric, options: WebVitalsReporter): Promise<void> {
  if (!options.report) {return;}

  const rating = getRating(metric.name as keyof typeof VITAL_THRESHOLDS, metric.value);

  const payload = {
    name: metric.name,
    value: metric.value,
    rating,
    id: metric.id,
    delta: metric.delta,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    analyticsId: options.analyticsId,
  };

  // Send to analytics endpoint
  if (options.endpoint) {
    try {
      await fetch(options.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
        // Use keepalive for reliability during page unload
        keepalive: true,
      });
    } catch (error) {
      // Silent fail - don't impact user experience
      console.debug('[Web Vitals] Failed to report:', error);
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const emoji =
      rating === 'good' ? '\u2705' : rating === 'needs-improvement' ? '\u26A0\uFE0F' : '\u274C';
    console.log(`[Web Vitals]${emoji} ${metric.name}:`, Math.round(metric.value), `(${rating})`);
  }

  // Store in session storage for debugging
  try {
    const existing = JSON.parse(sessionStorage.getItem('web-vitals') || '{}');
    sessionStorage.setItem(
      'web-vitals',
      JSON.stringify({
        ...existing,
        [metric.name]: payload,
      })
    );
  } catch {
    // Session storage might be disabled
  }
}

/**
 * Web Vitals monitoring component
 *
 * Tracks Core Web Vitals and reports them to analytics.
 * This component has no visual output - it only monitors performance.
 *
 * @param options - Configuration options for reporting
 */
export function WebVitals({
  report = true,
  endpoint = '/api/web-vitals',
  analyticsId,
}: WebVitalsReporter = {}): null {
  useEffect(() => {
    const options: WebVitalsReporter = { report, endpoint, analyticsId };

    // Core Web Vitals
    onCLS((metric) => {
      void sendToAnalytics(metric, options);
    });
    onFID((metric) => {
      void sendToAnalytics(metric, options);
    });
    onLCP((metric) => {
      void sendToAnalytics(metric, options);
    });

    // Other useful metrics
    onFCP((metric) => {
      void sendToAnalytics(metric, options);
    });
    onTTFB((metric) => {
      void sendToAnalytics(metric, options);
    });
    onINP((metric) => {
      void sendToAnalytics(metric, options);
    });
  }, [report, endpoint, analyticsId]);

  return null;
}

/**
 * Hook to get Web Vitals score
 * Returns overall performance rating based on all metrics
 */
export function useWebVitalsScore(): {
  score: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  metrics: Partial<Record<string, Metric>>;
} {
  // This would need to be implemented with state management
  // For now, return unknown
  return { score: 'unknown', metrics: {} };
}

/**
 * Performance budget checker
 * Use this to validate that your page meets performance budgets
 */
export function checkPerformanceBudgets(metrics: Metric[]): {
  passed: boolean;
  budgets: Array<{
    name: string;
    value: number;
    budget: number;
    passed: boolean;
  }>;
} {
  const budgets = [
    { name: 'LCP', value: 0, budget: 2500 },
    { name: 'FID', value: 0, budget: 100 },
    { name: 'CLS', value: 0, budget: 0.1 },
    { name: 'FCP', value: 0, budget: 1800 },
    { name: 'TTFB', value: 0, budget: 800 },
    { name: 'INP', value: 0, budget: 200 },
  ];

  for (const metric of metrics) {
    const budget = budgets.find((b) => b.name === metric.name);
    if (budget) {
      budget.value = metric.value;
    }
  }

  const passed = budgets.every((b) => b.value <= b.budget);

  return {
    passed,
    budgets: budgets.map((b) => ({
      ...b,
      passed: b.value <= b.budget,
    })),
  };
}

// Re-export types for convenience
export type { Metric };
