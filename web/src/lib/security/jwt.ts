/**
 * JWT (JSON Web Token) authentication and authorization utilities.
 * Provides token creation, verification, and validation for admin APIs.
 */

import { z } from 'zod';

/**
 * JWT payload structure for admin authentication.
 */
export interface JwtPayload {
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expiration time
  iss: string; // Issuer
  type: 'admin' | 'service'; // Token type
}

/**
 * JWT header structure.
 */
interface JwtHeader {
  alg: string;
  typ: string;
}

/**
 * Error types for JWT operations.
 */
export class JwtError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'MALFORMED_TOKEN'
  ) {
    super(message);
    this.name = 'JwtError';
  }
}

/**
 * Default token expiration time (24 hours).
 */
const DEFAULT_EXPIRATION = 24 * 60 * 60; // 24 hours in seconds

/**
 * Base64URL encoding helper.
 */
function base64FromBytes(bytes: Uint8Array): string {
  // Node.js
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Browser / Workers
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function bytesFromBase64(base64: string): Uint8Array {
  // Node.js
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  // Browser / Workers
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(data: string): string {
  const base64 = base64FromBytes(new TextEncoder().encode(data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decoding helper.
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return new TextDecoder().decode(bytesFromBase64(base64));
}

/**
 * Creates a JWT token for authentication.
 *
 * @param payload - The payload to include in the token
 * @param secret - The secret key for signing
 * @param expirationSeconds - Token expiration time in seconds (default: 24 hours)
 * @returns Signed JWT token
 *
 * @example
 * ```ts
 * const token = await createToken(
 *   { sub: "user123", type: "admin" },
 *   secret
 * );
 * ```
 */
export async function createToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> & {
    iss?: string;
    iat?: number;
    exp?: number;
  },
  secret: string,
  expirationSeconds: number = DEFAULT_EXPIRATION
): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  const now = Math.floor(Date.now() / 1000);
  const finalPayload: JwtPayload = {
    iss: payload.iss || 'bestblogs.dev',
    sub: payload.sub,
    iat: payload.iat || now,
    exp: payload.exp || now + expirationSeconds,
    type: payload.type,
  };

  // Encode header and payload
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(finalPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  // Sign with HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const message = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  const signatureArray = Array.from(new Uint8Array(signature));
  const encodedSignature = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `${data}.${encodedSignature}`;
}

/**
 * Verifies a JWT token and returns the payload.
 *
 * @param token - The token to verify
 * @param secret - The secret key for verification
 * @returns Verified JWT payload
 * @throws JwtError if token is invalid or expired
 *
 * @example
 * ```ts
 * try {
 *   const payload = await verifyToken(token, secret);
 *   console.log("User:", payload.sub);
 * } catch (err) {
 *   console.error("Invalid token");
 * }
 * ```
 */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  // Split token into parts
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtError('Invalid token format', 'MALFORMED_TOKEN');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Verify signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const message = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Convert hex signature to Uint8Array
  const signatureBytes = new Uint8Array(encodedSignature!.length / 2);
  for (let i = 0; i < signatureBytes.length; i++) {
    signatureBytes[i] = Number.parseInt(encodedSignature!.substr(i * 2, 2), 16);
  }

  const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, message);

  if (!isValid) {
    throw new JwtError('Invalid token signature', 'INVALID_TOKEN');
  }

  // Decode payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload!)) as JwtPayload;
  } catch {
    throw new JwtError('Invalid payload encoding', 'MALFORMED_TOKEN');
  }

  // Validate payload structure
  const payloadSchema = z.object({
    sub: z.string(),
    iat: z.number(),
    exp: z.number(),
    iss: z.string(),
    type: z.enum(['admin', 'service']),
  });

  try {
    payloadSchema.parse(payload);
  } catch {
    throw new JwtError('Invalid payload structure', 'MALFORMED_TOKEN');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new JwtError('Token has expired', 'EXPIRED_TOKEN');
  }

  return payload;
}

/**
 * Extracts a token from the Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The extracted token or null if not found
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {return null;}
  const match = authHeader.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/**
 * Creates an admin token for service accounts.
 *
 * @param subject - Subject identifier (e.g., "admin", "service-worker")
 * @param secret - JWT secret
 * @returns Signed admin token
 */
export async function createAdminToken(subject: string, secret: string): Promise<string> {
  return createToken({ sub: subject, type: 'admin' }, secret);
}

/**
 * Creates a service token for background workers.
 *
 * @param subject - Service identifier
 * @param secret - JWT secret
 * @param expirationHours - Token expiration in hours (default: 1 hour for services)
 * @returns Signed service token
 */
export async function createServiceToken(
  subject: string,
  secret: string,
  expirationHours: number = 1
): Promise<string> {
  return createToken({ sub: subject, type: 'service' }, secret, expirationHours * 3600);
}

/**
 * Middleware function to authenticate requests using JWT.
 * Returns the payload if valid, throws JwtError otherwise.
 *
 * @param authHeader - Authorization header value
 * @param secret - JWT secret
 * @returns Verified JWT payload
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const authHeader = request.headers.get("authorization");
 *   const payload = await authenticateRequest(authHeader, jwtSecret);
 *   // Proceed with authenticated request
 * }
 * ```
 */
export async function authenticateRequest(
  authHeader: string | null,
  secret: string
): Promise<JwtPayload> {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    throw new JwtError('No token provided', 'INVALID_TOKEN');
  }
  return verifyToken(token, secret);
}
