/**
 * Security headers middleware and utilities.
 * Provides CSP, CORS, and other security headers for HTTP responses.
 */

/**
 * Content Security Policy configuration.
 */
export interface CspConfig {
  /** Default source for all content types */
  defaultSrc?: string[];
  /** Script sources */
  scriptSrc?: string[];
  /** Style sources */
  styleSrc?: string[];
  /** Image sources */
  imgSrc?: string[];
  /** Font sources */
  fontSrc?: string[];
  /** Connect sources (fetch, XMLHttpRequest, etc.) */
  connectSrc?: string[];
  /** Frame sources */
  frameSrc?: string[];
  /** Allowed ancestors that can embed this page in a frame */
  frameAncestors?: string[];
  /** Object sources */
  objectSrc?: string[];
  /** Media sources */
  mediaSrc?: string[];
  /** Form action destinations */
  formAction?: string[];
  /** Base URL for relative URLs */
  baseUri?: string[];
  /** Whether to enable report-only mode */
  reportOnly?: boolean;
  /** URL to send CSP violation reports */
  reportUri?: string;
}

/**
 * Default CSP configuration for the BestBlogs.dev application.
 * Allows content from same origin, trusted CDNs, and common services.
 */
export const DEFAULT_CSP_CONFIG: CspConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
  ],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  imgSrc: [
    "'self'",
    'data:',
    'https:',
    'blob:',
    'https://*.bestblogs.dev',
    'https://*.cloudflareinsights.com',
  ],
  fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
  connectSrc: ["'self'", 'https://*.bestblogs.dev', 'https://*.cloudflareinsights.com'],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
  reportOnly: false,
};

/**
 * CORS configuration.
 */
export interface CorsConfig {
  /** Allowed origins (wildcard * for all origins) */
  allowedOrigins: string[];
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers exposed to browsers */
  exposedHeaders?: string[];
  /** Whether credentials are allowed */
  allowCredentials: boolean;
  /** Max age for preflight requests (seconds) */
  maxAge?: number;
}

/**
 * Default CORS configuration for public APIs.
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-Id',
    'X-Ingest-Secret',
    'X-Cron-Secret',
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  allowCredentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Strict CORS configuration for admin APIs.
 */
export const ADMIN_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  allowCredentials: true,
  maxAge: 86400,
};

/**
 * Builds a Content-Security-Policy header value.
 *
 * @param config - CSP configuration
 * @returns CSP header value
 */
export function buildCspHeader(config: CspConfig): string {
  const directives: string[] = [];

  const directiveMappings: Record<keyof CspConfig, string> = {
    defaultSrc: 'default-src',
    scriptSrc: 'script-src',
    styleSrc: 'style-src',
    imgSrc: 'img-src',
    fontSrc: 'font-src',
    connectSrc: 'connect-src',
    frameSrc: 'frame-src',
    frameAncestors: 'frame-ancestors',
    objectSrc: 'object-src',
    mediaSrc: 'media-src',
    formAction: 'form-action',
    baseUri: 'base-uri',
    reportUri: 'report-uri',
    reportOnly: '', // Handled separately
  };

  for (const [key, sources] of Object.entries(config)) {
    if (key === 'reportOnly') {
      continue;
    }

    const directiveName = directiveMappings[key as keyof CspConfig];
    if (!directiveName) {
      continue;
    }

    if (Array.isArray(sources)) {
      if (sources.length > 0) {
        directives.push(`${directiveName} ${sources.join(' ')}`);
      }
      continue;
    }

    if (typeof sources === 'string' && sources.length > 0) {
      directives.push(`${directiveName} ${sources}`);
    }
  }

  return directives.join('; ');
}

/**
 * Checks if an origin is allowed based on the CORS configuration.
 *
 * @param origin - Origin to check
 * @param config - CORS configuration
 * @returns true if origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  // Wildcard allows all origins
  if (config.allowedOrigins.includes('*')) {
    return true;
  }

  // No origin means same-origin request
  if (!origin) {
    return true;
  }

  let hostname = origin;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    // Origin may already be just a hostname; keep as-is.
  }

  // Check against allowed origins list
  return config.allowedOrigins.some((allowed) => {
    // Exact match
    if (allowed === origin) {
      return true;
    }

    // Wildcard subdomain matching (*.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return hostname === domain || hostname.endsWith(`.${domain}`);
    }

    return false;
  });
}

/**
 * Creates CORS headers for a response.
 *
 * @param origin - Origin of the request
 * @param config - CORS configuration
 * @returns Headers object with CORS directives
 */
export function createCorsHeaders(
  origin: string | null,
  config: CorsConfig
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (isOriginAllowed(origin, config)) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }

  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');

  if (config.exposedHeaders && config.exposedHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  }

  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (config.maxAge) {
    headers['Access-Control-Max-Age'] = String(config.maxAge);
  }

  return headers;
}

/**
 * Security headers to add to all responses.
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  csp?: CspConfig;
  /** Whether to enable CSP */
  enableCsp?: boolean;
  /** CORS configuration */
  cors?: CorsConfig;
  /** Whether to enable CORS */
  enableCors?: boolean;
  /** Whether to enable strict transport security (HTTPS only) */
  enableHsts?: boolean;
  /** Whether to enable frame protection */
  enableFrameProtection?: boolean;
  /** Whether to enable XSS protection */
  enableXssProtection?: boolean;
  /** Whether to enable no-referrer header */
  enableReferrerPolicy?: boolean;
  /** Whether to enable permissions policy */
  enablePermissionsPolicy?: boolean;
  /** Custom frame ancestors for frame protection */
  frameAncestors?: string[];
}

/**
 * Default security headers configuration.
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  csp: DEFAULT_CSP_CONFIG,
  enableCsp: true,
  cors: DEFAULT_CORS_CONFIG,
  enableCors: true,
  enableHsts: true,
  enableFrameProtection: true,
  enableXssProtection: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
  frameAncestors: ["'none'"],
};

/**
 * Creates security headers for an HTTP response.
 *
 * @param config - Security headers configuration
 * @param origin - Request origin for CORS
 * @returns Headers object with security directives
 */
export function createSecurityHeaders(
  config: SecurityHeadersConfig = DEFAULT_SECURITY_HEADERS,
  origin: string | null = null
): Headers {
  const headers = new Headers();

  // Content Security Policy
  if (config.enableCsp && config.csp) {
    const cspValue = buildCspHeader(config.csp);
    const headerName = config.csp.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    headers.set(headerName, cspValue);
  }

  // CORS headers
  if (config.enableCors && config.cors) {
    const corsHeaders = createCorsHeaders(origin, config.cors);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
  }

  // Strict-Transport-Security (HTTPS enforcement)
  if (config.enableHsts) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Frame protection (clickjacking prevention)
  if (config.enableFrameProtection) {
    headers.set('X-Frame-Options', 'DENY');
    // CSP frame-ancestors is already set in CSP
  }

  // XSS protection (legacy but still useful)
  if (config.enableXssProtection) {
    headers.set('X-XSS-Protection', '1; mode=block');
  }

  // Referrer policy
  if (config.enableReferrerPolicy) {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // Permissions policy (formerly Feature-Policy)
  if (config.enablePermissionsPolicy) {
    headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );
  }

  // Additional security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'same-site');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  return headers;
}

/**
 * Merges security headers with an existing Headers object.
 *
 * @param existing - Existing headers
 * @param config - Security headers configuration
 * @param origin - Request origin for CORS
 * @returns Merged headers
 */
export function mergeSecurityHeaders(
  existing: Headers,
  config: SecurityHeadersConfig = DEFAULT_SECURITY_HEADERS,
  origin: string | null = null
): Headers {
  const securityHeaders = createSecurityHeaders(config, origin);
  const merged = new Headers(existing);

  for (const [key, value] of securityHeaders.entries()) {
    // Don't override existing security headers
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  }

  return merged;
}

/**
 * Parses allowed origins from environment variable.
 * Accepts comma-separated values or * for wildcard.
 *
 * @param envVar - Environment variable value
 * @returns Array of allowed origins
 */
export function parseAllowedOrigins(envVar: string): string[] {
  if (!envVar || envVar.trim() === '*') {
    return ['*'];
  }

  return envVar
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses CSP enabled flag from environment.
 */
export function parseCspEnabled(envVar: string | undefined): boolean {
  if (!envVar) {
    return true;
  }
  return envVar.toLowerCase() !== 'false' && envVar !== '0';
}

/**
 * Creates security headers config from environment variables.
 */
export function createSecurityConfigFromEnv(
  env: Record<string, string | undefined>
): SecurityHeadersConfig {
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '*');
  const enableCsp = parseCspEnabled(env.CSP_ENABLED);

  return {
    enableCsp,
    csp: DEFAULT_CSP_CONFIG,
    enableCors: true,
    cors: {
      ...DEFAULT_CORS_CONFIG,
      allowedOrigins,
    },
    enableHsts: true,
    enableFrameProtection: true,
    enableXssProtection: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    frameAncestors: ["'none'"],
  };
}

/**
 * Handles OPTIONS request for CORS preflight.
 * Returns appropriate CORS headers for the preflight request.
 *
 * @param origin - Request origin
 * @param config - CORS configuration
 * @returns Response with CORS headers
 */
export function handleCorsPreflight(
  origin: string | null,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): Response {
  const headers = createCorsHeaders(origin, config);
  return new Response(null, { status: 204, headers: new Headers(headers) });
}
