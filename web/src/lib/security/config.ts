/**
 * Environment configuration validation and management.
 * Provides runtime validation of all required environment variables.
 */

import { z } from 'zod';

/**
 * Schema for validating environment variables.
 * All secrets should come from wrangler vars (production) or process.env (development).
 */
const envSchema = z.object({
  // Public URLs
  SITE_URL: z.string().url().optional().default('http://localhost:3000'),

  // Secrets - must be set in production
  INGEST_SECRET: z.string().min(32, 'INGEST_SECRET must be at least 32 characters'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters'),

  // JWT Secret for admin authentication (optional for backward compatibility)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_ISSUER: z.string().optional().default('bestblogs.dev'),

  // Rate limiting configuration
  RATE_LIMIT_ENABLED: z.string().optional().default('true'),
  RATE_LIMIT_PUBLIC_REQUESTS: z.string().optional().default('60'),
  RATE_LIMIT_PUBLIC_WINDOW: z.string().optional().default('60'),
  RATE_LIMIT_SEARCH_REQUESTS: z.string().optional().default('20'),
  RATE_LIMIT_SEARCH_WINDOW: z.string().optional().default('60'),
  RATE_LIMIT_INGEST_REQUESTS: z.string().optional().default('10'),
  RATE_LIMIT_INGEST_WINDOW: z.string().optional().default('60'),

  // Security configuration
  ALLOWED_ORIGINS: z.string().optional().default('*'),
  CSP_ENABLED: z.string().optional().default('true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validated environment configuration.
 * Cached after first validation to avoid repeated validation overhead.
 */
let cachedConfig: EnvConfig | null = null;

/**
 * Validates and returns the environment configuration.
 * Throws an error if validation fails.
 *
 * @param env - The environment object from Cloudflare or process.env
 * @returns Validated environment configuration
 */
export function validateEnv(env: Record<string, string | undefined>): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = envSchema.parse(env);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter((e) => e.code === 'invalid_type' || e.code === 'too_small')
        .map((e) => e.path.join('.'))
        .filter(Boolean);

      throw new Error(
        `Environment validation failed. Missing or invalid variables: ${missingVars.join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Gets a configuration value with type safety.
 * @param key - Configuration key
 * @returns Configuration value or undefined if not set
 */
export function getConfigValue<K extends keyof EnvConfig>(key: K): EnvConfig[K] | undefined {
  if (!cachedConfig) {
    throw new Error('Configuration not validated. Call validateEnv() first.');
  }
  return cachedConfig[key];
}

/**
 * Resets the cached configuration (useful for testing).
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Converts string environment values to numbers with defaults.
 */
export function parseEnvNumber(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Converts string environment values to booleans.
 */
export function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return true;
}
