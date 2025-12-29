/**
 * Tests for security headers utilities
 */

import { describe, it, expect } from 'vitest';

import {
  buildCspHeader,
  isOriginAllowed,
  createCorsHeaders,
  createSecurityHeaders,
  mergeSecurityHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
  parseCspEnabled,
  createSecurityConfigFromEnv,
  DEFAULT_CSP_CONFIG,
  DEFAULT_CORS_CONFIG,
  DEFAULT_SECURITY_HEADERS,
} from './headers';

describe('security headers', () => {
  describe('buildCspHeader', () => {
    it('builds complete CSP from config', () => {
      const csp = buildCspHeader(DEFAULT_CSP_CONFIG);

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('img-src');
      expect(csp).toContain('connect-src');
    });

    it('includes all script sources', () => {
      const config = {
        ...DEFAULT_CSP_CONFIG,
        scriptSrc: ["'self'", 'https://cdn.example.com'],
      };
      const csp = buildCspHeader(config);

      expect(csp).toContain("'self'");
      expect(csp).toContain('https://cdn.example.com');
    });

    it('handles empty arrays', () => {
      const config = {
        defaultSrc: [],
        scriptSrc: [],
      };
      const csp = buildCspHeader(config);

      // Should not include directives with no sources
      expect(csp).not.toContain('default-src');
      expect(csp).not.toContain('script-src');
    });

    it('joins multiple sources with spaces', () => {
      const config = {
        defaultSrc: ["'self'", 'https://example.com', 'https://cdn.example.com'],
      };
      const csp = buildCspHeader(config);

      expect(csp).toContain("default-src 'self' https://example.com https://cdn.example.com");
    });

    it('handles frame-ancestors correctly', () => {
      const config = {
        frameAncestors: ["'none'"],
      };
      const csp = buildCspHeader(config);

      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('isOriginAllowed', () => {
    it('allows all origins when wildcard is present', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['*'],
      };

      expect(isOriginAllowed('https://example.com', config)).toBe(true);
      expect(isOriginAllowed('https://malicious.com', config)).toBe(true);
    });

    it('allows exact match origins', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://example.com', 'https://trusted.com'],
      };

      expect(isOriginAllowed('https://example.com', config)).toBe(true);
      expect(isOriginAllowed('https://trusted.com', config)).toBe(true);
      expect(isOriginAllowed('https://malicious.com', config)).toBe(false);
    });

    it('allows null origin (same-origin request)', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://example.com'],
      };

      expect(isOriginAllowed(null, config)).toBe(true);
    });

    it('handles wildcard subdomain matching', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['*.example.com'],
      };

      expect(isOriginAllowed('https://sub.example.com', config)).toBe(true);
      expect(isOriginAllowed('https://api.example.com', config)).toBe(true);
      expect(isOriginAllowed('https://example.com', config)).toBe(true);
      expect(isOriginAllowed('https://other.com', config)).toBe(false);
    });

    it('handles multiple wildcard patterns', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['*.example.com', '*.trusted.com'],
      };

      expect(isOriginAllowed('https://api.example.com', config)).toBe(true);
      expect(isOriginAllowed('https://sub.trusted.com', config)).toBe(true);
    });
  });

  describe('createCorsHeaders', () => {
    it('creates CORS headers for allowed origin', () => {
      const origin = 'https://example.com';
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://example.com'],
      };

      const headers = createCorsHeaders(origin, config);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, HEAD, OPTIONS');
      expect(headers['Access-Control-Allow-Headers']).toBeDefined();
    });

    it('uses wildcard when origin not in list but wildcard allowed', () => {
      const origin = 'https://any-origin.com';
      const config = DEFAULT_CORS_CONFIG;

      const headers = createCorsHeaders(origin, config);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://any-origin.com');
    });

    it('includes exposed headers when configured', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        exposedHeaders: ['X-Custom-Header', 'X-Another-Header'],
      };

      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Expose-Headers']).toBe('X-Custom-Header, X-Another-Header');
    });

    it('includes allow-credentials when enabled', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowCredentials: true,
      };

      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('includes max-age when configured', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        maxAge: 3600,
      };

      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Max-Age']).toBe('3600');
    });

    it('handles null origin', () => {
      const config = DEFAULT_CORS_CONFIG;

      const headers = createCorsHeaders(null, config);

      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('createSecurityHeaders', () => {
    it('creates all security headers', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('Content-Security-Policy')).toBeTruthy();
      expect(headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-XSS-Protection')).toBeTruthy();
      expect(headers.get('Referrer-Policy')).toBeTruthy();
      expect(headers.get('Permissions-Policy')).toBeTruthy();
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('includes CORS headers when enabled', () => {
      const headers = createSecurityHeaders(
        {
          ...DEFAULT_SECURITY_HEADERS,
          enableCors: true,
          cors: DEFAULT_CORS_CONFIG,
        },
        'https://example.com'
      );

      expect(headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('respects enableCsp flag', () => {
      const headers = createSecurityHeaders({
        ...DEFAULT_SECURITY_HEADERS,
        enableCsp: false,
      });

      expect(headers.get('Content-Security-Policy')).toBeNull();
    });

    it('respects enableHsts flag', () => {
      const headers = createSecurityHeaders({
        ...DEFAULT_SECURITY_HEADERS,
        enableHsts: false,
      });

      expect(headers.get('Strict-Transport-Security')).toBeNull();
    });

    it('respects enableFrameProtection flag', () => {
      const headers = createSecurityHeaders({
        ...DEFAULT_SECURITY_HEADERS,
        enableFrameProtection: false,
      });

      expect(headers.get('X-Frame-Options')).toBeNull();
    });

    it('includes CSP report-only when configured', () => {
      const headers = createSecurityHeaders({
        ...DEFAULT_SECURITY_HEADERS,
        csp: { ...DEFAULT_CSP_CONFIG, reportOnly: true },
      });

      expect(headers.get('Content-Security-Policy-Report-Only')).toBeTruthy();
      expect(headers.get('Content-Security-Policy')).toBeNull();
    });
  });

  describe('mergeSecurityHeaders', () => {
    it('merges security headers into existing headers', () => {
      const existing = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      });

      const merged = mergeSecurityHeaders(existing);

      expect(merged.get('Content-Type')).toBe('application/json');
      expect(merged.get('X-Custom-Header')).toBe('custom-value');
      expect(merged.get('X-Frame-Options')).toBe('DENY');
    });

    it('does not override existing security headers', () => {
      const existing = new Headers({
        'X-Frame-Options': 'SAMEORIGIN',
      });

      const merged = mergeSecurityHeaders(existing);

      expect(merged.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });
  });

  describe('handleCorsPreflight', () => {
    it('returns 204 response with CORS headers', () => {
      const response = handleCorsPreflight('https://example.com');

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    it('includes max-age header', () => {
      const response = handleCorsPreflight('https://example.com');

      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  describe('parseAllowedOrigins', () => {
    it('returns wildcard for empty string', () => {
      expect(parseAllowedOrigins('')).toEqual(['*']);
    });

    it('returns wildcard for asterisk', () => {
      expect(parseAllowedOrigins('*')).toEqual(['*']);
    });

    it('parses comma-separated origins', () => {
      const origins = parseAllowedOrigins('https://example.com,https://trusted.com');

      expect(origins).toEqual(['https://example.com', 'https://trusted.com']);
    });

    it('trims whitespace from origins', () => {
      const origins = parseAllowedOrigins('https://example.com , https://trusted.com');

      expect(origins).toEqual(['https://example.com', 'https://trusted.com']);
    });

    it('filters out empty strings', () => {
      const origins = parseAllowedOrigins('https://example.com, ,https://trusted.com');

      expect(origins).toEqual(['https://example.com', 'https://trusted.com']);
    });
  });

  describe('parseCspEnabled', () => {
    it('defaults to true when undefined', () => {
      expect(parseCspEnabled(undefined)).toBe(true);
    });

    it("returns true for 'true'", () => {
      expect(parseCspEnabled('true')).toBe(true);
      expect(parseCspEnabled('TRUE')).toBe(true);
    });

    it("returns false for 'false'", () => {
      expect(parseCspEnabled('false')).toBe(false);
      expect(parseCspEnabled('FALSE')).toBe(false);
    });

    it("returns false for '0'", () => {
      expect(parseCspEnabled('0')).toBe(false);
    });

    it('returns true for other values', () => {
      expect(parseCspEnabled('1')).toBe(true);
      expect(parseCspEnabled('yes')).toBe(true);
    });
  });

  describe('createSecurityConfigFromEnv', () => {
    it('creates config from environment variables', () => {
      const env = {
        ALLOWED_ORIGINS: 'https://example.com,https://trusted.com',
        CSP_ENABLED: 'true',
      };

      const config = createSecurityConfigFromEnv(env);

      expect(config.cors?.allowedOrigins).toEqual(['https://example.com', 'https://trusted.com']);
      expect(config.enableCsp).toBe(true);
    });

    it('uses defaults when env vars not set', () => {
      const config = createSecurityConfigFromEnv({});

      expect(config.cors?.allowedOrigins).toEqual(['*']);
      expect(config.enableCsp).toBe(true);
    });

    it('handles wildcard origins', () => {
      const env = {
        ALLOWED_ORIGINS: '*',
      };

      const config = createSecurityConfigFromEnv(env);

      expect(config.cors?.allowedOrigins).toEqual(['*']);
    });
  });

  describe('header values', () => {
    it('has correct HSTS value', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('has correct X-Frame-Options value', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('has correct X-XSS-Protection value', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('has correct Referrer-Policy value', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('has correct Permissions-Policy value', () => {
      const headers = createSecurityHeaders();

      const policy = headers.get('Permissions-Policy');
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('camera=()');
    });

    it('has correct X-Content-Type-Options value', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('has Cross-Origin headers', () => {
      const headers = createSecurityHeaders();

      expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-site');
      expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });
  });

  describe('edge cases', () => {
    it('handles empty CSP config', () => {
      const csp = buildCspHeader({});

      expect(csp).toBe('');
    });

    it('handles CORS with no allowed origins', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: [],
      };

      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('handles origins with ports', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://localhost:3000'],
      };

      expect(isOriginAllowed('https://localhost:3000', config)).toBe(true);
      expect(isOriginAllowed('https://localhost:3001', config)).toBe(false);
    });

    it('handles special characters in origins', () => {
      const config = {
        ...DEFAULT_CORS_CONFIG,
        allowedOrigins: ['https://sub-domain.example.com'],
      };

      expect(isOriginAllowed('https://sub-domain.example.com', config)).toBe(true);
    });
  });
});
