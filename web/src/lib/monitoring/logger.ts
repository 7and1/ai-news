// Structured logging utility for BestBlogs.dev
import { getEnv } from '@/lib/d1';

import type { LogLevel, LogContext, LogEntry } from './types';

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI color codes for console output (works in Cloudflare Workers logs)
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.dim,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
};

// Store correlation ID in async local storage equivalent
let currentCorrelationId: string | undefined;
let currentRequestId: string | undefined;

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return 'corr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Set the current correlation ID for this request context
 */
export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

/**
 * Set the current request ID for this request context
 */
export function setRequestId(id: string): void {
  currentRequestId = id;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return currentCorrelationId;
}

/**
 * Get the current request ID
 */
export function getRequestId(): string | undefined {
  return currentRequestId;
}

/**
 * Clear the current request context
 */
export function clearRequestContext(): void {
  currentCorrelationId = undefined;
  currentRequestId = undefined;
}

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const levelColor = LEVEL_COLORS[entry.level];
  const reset = COLORS.reset;
  const bright = COLORS.bright;

  const parts: string[] = [];

  // Timestamp
  parts.push(bright + timestamp + reset);

  // Level
  parts.push(levelColor + entry.level.toUpperCase().padEnd(5) + reset);

  // Correlation/Request IDs
  if (entry.correlationId) {
    parts.push(COLORS.cyan + '[' + entry.correlationId + ']' + reset);
  }
  if (entry.requestId) {
    parts.push(COLORS.dim + '[' + entry.requestId + ']' + reset);
  }

  // Message
  parts.push(entry.message);

  // Context
  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = JSON.stringify(entry.context);
    parts.push(COLORS.dim + contextStr + reset);
  }

  // HTTP info if available
  if (entry.method && entry.path) {
    parts.unshift(bright + entry.method + reset + ' ' + entry.path);
  }

  if (entry.statusCode) {
    const statusColor =
      entry.statusCode >= 500
        ? COLORS.red
        : entry.statusCode >= 400
          ? COLORS.yellow
          : entry.statusCode >= 300
            ? COLORS.cyan
            : COLORS.green;
    parts.push(statusColor + String(entry.statusCode) + reset);
  }

  if (entry.duration !== undefined) {
    parts.push(COLORS.dim + entry.duration.toFixed(2) + 'ms' + reset);
  }

  return parts.join(' ');
}

/**
 * Check if a log level should be logged based on configured level
 */
async function shouldLog(level: LogLevel): Promise<boolean> {
  try {
    const env = await getEnv();
    const configuredLevel = (env.LOG_LEVEL ?? 'info') as LogLevel;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
  } catch {
    return true; // Default to allowing all logs if env is not available
  }
}

/**
 * Core logging function
 */
async function writeLog(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  if (!(await shouldLog(level))) {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: Date.now(),
    context,
    correlationId: currentCorrelationId,
    requestId: currentRequestId,
  };

  // Format and log to console
  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }

  // Persist to KV if available (async, don't await)
  try {
    const env = await getEnv();
    if (env.LOGS) {
      // Store logs with a TTL of 7 days
      const logKey = 'log:' + Date.now() + ':' + Math.random().toString(36).substring(2);
      env.LOGS.put(logKey, JSON.stringify(entry), {
        expirationTtl: 7 * 24 * 60 * 60, // 7 days
      }).catch(() => {
        // Silently fail if KV write fails
      });
    }
  } catch {
    // KV not available in all environments
  }
}

/**
 * Logger class for structured logging with context
 */
export class Logger {
  private readonly baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  /**
   * Create a child logger with additional context
   */
  withContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): Promise<void> {
    return writeLog('debug', message, { ...this.baseContext, ...context });
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): Promise<void> {
    return writeLog('info', message, { ...this.baseContext, ...context });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): Promise<void> {
    return writeLog('warn', message, { ...this.baseContext, ...context });
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): Promise<void> {
    return writeLog('error', message, { ...this.baseContext, ...context });
  }

  /**
   * Log an HTTP request
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): Promise<void> {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    return writeLog(level, method + ' ' + path, {
      ...this.baseContext,
      ...context,
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * Log a database query
   */
  logQuery(query: string, duration: number, context?: LogContext): Promise<void> {
    return writeLog('debug', 'DB Query: ' + query.substring(0, 100) + '...', {
      ...this.baseContext,
      ...context,
      query: query.substring(0, 500),
      duration,
    });
  }

  /**
   * Log an external API call
   */
  logExternalApi(
    service: string,
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    context?: LogContext
  ): Promise<void> {
    const level = statusCode && statusCode >= 500 ? 'warn' : 'info';
    return writeLog(level, 'External API: ' + service + ' ' + method, {
      ...this.baseContext,
      ...context,
      service,
      method,
      url,
      statusCode,
      duration,
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience functions that use the default logger
export const debug = (message: string, context?: LogContext) => logger.debug(message, context);
export const info = (message: string, context?: LogContext) => logger.info(message, context);
export const warn = (message: string, context?: LogContext) => logger.warn(message, context);
export const error = (message: string, context?: LogContext) => logger.error(message, context);
