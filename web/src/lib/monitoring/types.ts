// Core monitoring types for BestBlogs.dev

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: LogContext;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface ErrorEntry {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  name: string;
  context?: ErrorContext;
  fingerprint: string;
  resolved: boolean;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface MetricType {
  counter: 'counter';
  gauge: 'gauge';
  histogram: 'histogram';
}

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  type: 'counter';
  name: string;
  description: string;
  values: MetricValue[];
  labels?: Record<string, string>;
}

export interface GaugeMetric {
  type: 'gauge';
  name: string;
  description: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface HistogramMetric {
  type: 'histogram';
  name: string;
  description: string;
  buckets: number[];
  counts: Record<number, number>;
  sum: number;
  count: number;
  min: number;
  max: number;
  labels?: Record<string, string>;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
  labels?: Record<string, string>;
}

export interface DatabaseQueryMetric extends PerformanceMetric {
  query: string;
  params?: unknown[];
  rowsAffected?: number;
}

export interface ExternalApiCallMetric extends PerformanceMetric {
  url: string;
  method: string;
  statusCode?: number;
  service: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn' | 'degraded';
  name: string;
  description?: string;
  duration?: number;
  output?: string;
  observedValue?: unknown;
  observedUnit?: string;
}

export interface AlertCondition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'error_rate' | 'response_time' | 'error_count' | 'metric_threshold';
  threshold: number;
  windowSeconds: number;
  notificationChannels: string[];
  lastTriggered?: number;
  triggerCount: number;
}

export interface AlertEvent {
  id: string;
  conditionId: string;
  conditionName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  data: Record<string, unknown>;
}

export interface RequestMetrics {
  count: number;
  errorCount: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  statusCodeCounts: Record<number, number>;
}

export interface EndpointMetrics {
  path: string;
  method: string;
  metrics: RequestMetrics;
  lastRequestAt: number;
}

export interface BusinessMetrics {
  articlesProcessed: number;
  articlesCreated: number;
  articlesUpdated: number;
  sourcesActive: number;
  sourcesWithError: number;
  lastCrawlAt?: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeriesData {
  metric: string;
  labels?: Record<string, string>;
  points: TimeSeriesPoint[];
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}
