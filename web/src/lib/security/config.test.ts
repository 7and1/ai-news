/**
 * Tests for environment configuration validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  validateEnv,
  getConfigValue,
  resetConfig,
  parseEnvNumber,
  parseEnvBoolean,
} from './config';

describe('environment configuration validation', () => {
  beforeEach(() => {
    resetConfig();
    vi.clearAllMocks();
  });

  describe('validateEnv', () => {
    it('validates valid environment configuration', () => {
      const env = {
        SITE_URL: 'https://example.com',
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        JWT_SECRET: 'c'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.SITE_URL).toBe('https://example.com');
      expect(config.INGEST_SECRET).toBe('a'.repeat(32));
      expect(config.CRON_SECRET).toBe('b'.repeat(32));
      expect(config.JWT_SECRET).toBe('c'.repeat(32));
    });

    it('throws error for missing INGEST_SECRET', () => {
      const env = {
        SITE_URL: 'https://example.com',
        CRON_SECRET: 'b'.repeat(32),
      };

      expect(() => validateEnv(env)).toThrow('Environment validation failed');
    });

    it('throws error for INGEST_SECRET under 32 characters', () => {
      const env = {
        SITE_URL: 'https://example.com',
        INGEST_SECRET: 'short',
        CRON_SECRET: 'b'.repeat(32),
      };

      expect(() => validateEnv(env)).toThrow('Environment validation failed');
    });

    it('throws error for missing CRON_SECRET', () => {
      const env = {
        SITE_URL: 'https://example.com',
        INGEST_SECRET: 'a'.repeat(32),
      };

      expect(() => validateEnv(env)).toThrow('Environment validation failed');
    });

    it('allows JWT_SECRET to be optional', () => {
      const env = {
        SITE_URL: 'https://example.com',
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.JWT_SECRET).toBeUndefined();
    });

    it('uses default values for optional fields', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.SITE_URL).toBe('http://localhost:3000');
      expect(config.JWT_ISSUER).toBe('bestblogs.dev');
    });

    it('uses default rate limit values', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.RATE_LIMIT_PUBLIC_REQUESTS).toBe('60');
      expect(config.RATE_LIMIT_PUBLIC_WINDOW).toBe('60');
    });

    it('respects custom rate limit values', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        RATE_LIMIT_PUBLIC_REQUESTS: '100',
        RATE_LIMIT_PUBLIC_WINDOW: '30',
      };

      const config = validateEnv(env);

      expect(config.RATE_LIMIT_PUBLIC_REQUESTS).toBe('100');
      expect(config.RATE_LIMIT_PUBLIC_WINDOW).toBe('30');
    });

    it('caches the configuration', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config1 = validateEnv(env);
      const config2 = validateEnv(env);

      expect(config1).toBe(config2);
    });

    it('uses default ALLOWED_ORIGINS', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.ALLOWED_ORIGINS).toBe('*');
    });

    it('uses default CSP_ENABLED', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      const config = validateEnv(env);

      expect(config.CSP_ENABLED).toBe('true');
    });

    it('handles undefined values correctly', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        JWT_SECRET: undefined,
      };

      const config = validateEnv(env);

      expect(config.JWT_SECRET).toBeUndefined();
    });
  });

  describe('getConfigValue', () => {
    it('returns value for valid key after validation', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        SITE_URL: 'https://test.com',
      };

      validateEnv(env);

      const value = getConfigValue('SITE_URL');

      expect(value).toBe('https://test.com');
    });

    it('throws error when config not validated', () => {
      resetConfig();

      expect(() => getConfigValue('SITE_URL')).toThrow('Configuration not validated');
    });

    it('returns undefined for optional fields not set', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      validateEnv(env);

      const value = getConfigValue('JWT_SECRET');

      expect(value).toBeUndefined();
    });

    it('returns typed values correctly', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        RATE_LIMIT_PUBLIC_REQUESTS: '100',
      };

      validateEnv(env);

      const value = getConfigValue('RATE_LIMIT_PUBLIC_REQUESTS');

      expect(value).toBe('100');
    });
  });

  describe('resetConfig', () => {
    it('clears cached configuration', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      validateEnv(env);
      resetConfig();

      expect(() => getConfigValue('SITE_URL')).toThrow('Configuration not validated');
    });

    it('allows re-validation after reset', () => {
      const env1 = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
      };

      validateEnv(env1);
      resetConfig();

      const env2 = {
        INGEST_SECRET: 'c'.repeat(32),
        CRON_SECRET: 'd'.repeat(32),
        SITE_URL: 'https://new-url.com',
      };

      const config = validateEnv(env2);

      expect(config.SITE_URL).toBe('https://new-url.com');
    });
  });

  describe('parseEnvNumber', () => {
    it('returns number for valid numeric string', () => {
      expect(parseEnvNumber('123', 0)).toBe(123);
      expect(parseEnvNumber('456.78', 0)).toBe(456);
    });

    it('returns default for undefined', () => {
      expect(parseEnvNumber(undefined, 100)).toBe(100);
    });

    it('returns default for empty string', () => {
      expect(parseEnvNumber('', 100)).toBe(100);
    });

    it('returns default for invalid number', () => {
      expect(parseEnvNumber('not-a-number', 100)).toBe(100);
    });

    it('handles negative numbers', () => {
      expect(parseEnvNumber('-50', 0)).toBe(-50);
    });

    it('handles zero', () => {
      expect(parseEnvNumber('0', 100)).toBe(0);
    });
  });

  describe('parseEnvBoolean', () => {
    it("returns true for 'true' string", () => {
      expect(parseEnvBoolean('true', false)).toBe(true);
      expect(parseEnvBoolean('TRUE', false)).toBe(true);
      expect(parseEnvBoolean('True', false)).toBe(true);
    });

    it("returns false for 'false' string", () => {
      expect(parseEnvBoolean('false', true)).toBe(false);
      expect(parseEnvBoolean('FALSE', true)).toBe(false);
      expect(parseEnvBoolean('False', true)).toBe(false);
    });

    it("returns true for '1' string", () => {
      expect(parseEnvBoolean('1', false)).toBe(true);
    });

    it("returns false for '0' string", () => {
      expect(parseEnvBoolean('0', true)).toBe(false);
    });

    it('returns default for undefined', () => {
      expect(parseEnvBoolean(undefined, true)).toBe(true);
      expect(parseEnvBoolean(undefined, false)).toBe(false);
    });

    it('returns default for empty string', () => {
      expect(parseEnvBoolean('', true)).toBe(true);
    });

    it('returns true for any other value', () => {
      expect(parseEnvBoolean('yes', false)).toBe(true);
      expect(parseEnvBoolean('enabled', false)).toBe(true);
    });
  });

  describe('security validation', () => {
    it('requires minimum secret length', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(31), // One character short
        CRON_SECRET: 'b'.repeat(32),
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it('validates all required secrets', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(31), // Too short
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it('validates URL format for SITE_URL', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        SITE_URL: 'not-a-valid-url',
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it('accepts valid URLs', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        SITE_URL: 'https://example.com:3000',
      };

      const config = validateEnv(env);

      expect(config.SITE_URL).toBe('https://example.com:3000');
    });

    it('accepts localhost URLs', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        SITE_URL: 'http://localhost:3000',
      };

      const config = validateEnv(env);

      expect(config.SITE_URL).toBe('http://localhost:3000');
    });
  });

  describe('rate limit configuration', () => {
    it('parses all rate limit values', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        RATE_LIMIT_ENABLED: 'true',
        RATE_LIMIT_PUBLIC_REQUESTS: '100',
        RATE_LIMIT_PUBLIC_WINDOW: '60',
        RATE_LIMIT_SEARCH_REQUESTS: '30',
        RATE_LIMIT_SEARCH_WINDOW: '60',
        RATE_LIMIT_INGEST_REQUESTS: '10',
        RATE_LIMIT_INGEST_WINDOW: '60',
      };

      const config = validateEnv(env);

      expect(config.RATE_LIMIT_ENABLED).toBe('true');
      expect(config.RATE_LIMIT_PUBLIC_REQUESTS).toBe('100');
      expect(config.RATE_LIMIT_PUBLIC_WINDOW).toBe('60');
      expect(config.RATE_LIMIT_SEARCH_REQUESTS).toBe('30');
      expect(config.RATE_LIMIT_SEARCH_WINDOW).toBe('60');
      expect(config.RATE_LIMIT_INGEST_REQUESTS).toBe('10');
      expect(config.RATE_LIMIT_INGEST_WINDOW).toBe('60');
    });
  });

  describe('error messages', () => {
    it('provides helpful error for missing variables', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        // Missing CRON_SECRET
      };

      try {
        validateEnv(env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Environment validation failed');
      }
    });

    it('includes field names in error message', () => {
      const env = {
        INGEST_SECRET: 'short',
        CRON_SECRET: 'b'.repeat(32),
      };

      try {
        validateEnv(env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('INGEST_SECRET');
      }
    });
  });

  describe('edge cases', () => {
    it('handles very long secrets', () => {
      const longSecret = 'a'.repeat(1000);
      const env = {
        INGEST_SECRET: longSecret,
        CRON_SECRET: longSecret,
      };

      const config = validateEnv(env);

      expect(config.INGEST_SECRET).toBe(longSecret);
      expect(config.CRON_SECRET).toBe(longSecret);
    });

    it('handles special characters in secrets', () => {
      const specialSecret = '!@#$%^&*()_+-=[]{}|;:,.<>?/'.repeat(2);
      const env = {
        INGEST_SECRET: specialSecret,
        CRON_SECRET: specialSecret,
      };

      const config = validateEnv(env);

      expect(config.INGEST_SECRET).toBe(specialSecret);
    });

    it('handles whitespace in values', () => {
      const env = {
        INGEST_SECRET: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
        ALLOWED_ORIGINS: 'https://example.com , https://trusted.com',
      };

      const config = validateEnv(env);

      expect(config.ALLOWED_ORIGINS).toBe('https://example.com , https://trusted.com');
    });
  });
});
