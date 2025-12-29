// Main entry point for monitoring utilities
export * from './types';
export * from './logger';
export * from './errors';
export * from './metrics';
export * from './performance';
export * from './health';
export * from './alerting';

// Convenience re-exports
export { logger } from './logger';
export {
  generateCorrelationId,
  setCorrelationId,
  getCorrelationId,
  generateRequestId,
  setRequestId,
  getRequestId,
  clearRequestContext,
} from './logger';
export {
  reportError,
  resolveError,
  getError,
  listRecentErrors,
  getErrorStats,
  HttpError,
  Errors,
} from './errors';
export {
  incrementCounter,
  setGauge,
  recordHistogram,
  trackHttpRequest,
  trackDbQuery,
  trackExternalApiCall,
  BusinessMetrics,
  getAllMetrics,
  exportPrometheusMetrics,
} from './metrics';
export {
  measurePerformance,
  trackQuery,
  trackExternalCall,
  trackedFetch,
  createTimer,
  withTiming,
  PerformanceTimer,
} from './performance';
export {
  checkDatabase,
  checkKV,
  checkR2,
  checkExternalService,
  performHealthCheck,
  livenessCheck,
  readinessCheck,
} from './health';
export {
  triggerAlert,
  evaluateAlertCondition,
  getAlertConditions,
  getRecentAlerts,
  resolveAlert,
  updateAlertCondition,
  evaluateAllAlerts,
  DEFAULT_ALERT_CONDITIONS,
} from './alerting';
