/**
 * Tests for JWT authentication utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createToken,
  verifyToken,
  createAdminToken,
  createServiceToken,
  extractTokenFromHeader,
  authenticateRequest,
  JwtError,
} from './jwt';

describe('JWT utilities', () => {
  const testSecret = 'test-secret-key-at-least-32-characters-long';
  const testIssuer = 'test-issuer';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createToken', () => {
    it('creates a valid JWT token', async () => {
      const payload = {
        sub: 'user-123',
        type: 'admin' as const,
      };
      const token = await createToken(payload, testSecret);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // JWT should have 3 parts separated by dots
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('includes all payload fields', async () => {
      const payload = {
        sub: 'user-123',
        type: 'admin' as const,
        iss: testIssuer,
      };
      const token = await createToken(payload, testSecret);

      // Decode the payload (second part)
      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));

      expect(decodedPayload.sub).toBe('user-123');
      expect(decodedPayload.type).toBe('admin');
      expect(decodedPayload.iss).toBe(testIssuer);
      expect(decodedPayload.iat).toBeTruthy();
      expect(decodedPayload.exp).toBeTruthy();
    });

    it('sets default expiration to 24 hours', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const token = await createToken(payload, testSecret);

      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));

      expect(decodedPayload.exp - decodedPayload.iat).toBe(24 * 60 * 60);
    });

    it('respects custom expiration time', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const expirationSeconds = 3600; // 1 hour
      const token = await createToken(payload, testSecret, expirationSeconds);

      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));

      expect(decodedPayload.exp - decodedPayload.iat).toBe(expirationSeconds);
    });

    it('allows custom iat and exp', async () => {
      const customIat = 1700000000;
      const customExp = 1700003600;
      const payload = {
        sub: 'user-123',
        type: 'admin' as const,
        iat: customIat,
        exp: customExp,
      };
      const token = await createToken(payload, testSecret);

      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));

      expect(decodedPayload.iat).toBe(customIat);
      expect(decodedPayload.exp).toBe(customExp);
    });

    it('throws error when crypto is not available', async () => {
      // Temporarily hide crypto.subtle
      const originalSubtle = crypto.subtle;
      Object.defineProperty(crypto, 'subtle', { value: undefined });

      await expect(createToken({ sub: 'user', type: 'admin' }, testSecret)).rejects.toThrow(
        'Web Crypto API is not available'
      );

      // Restore
      Object.defineProperty(crypto, 'subtle', { value: originalSubtle });
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid token', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const token = await createToken(payload, testSecret);

      const decoded = await verifyToken(token, testSecret);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.type).toBe('admin');
      expect(decoded.iss).toBe('bestblogs.dev');
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
    });

    it('rejects tokens with invalid signature', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const token = await createToken(payload, testSecret);

      // Tamper with the token
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedsignature`;

      await expect(verifyToken(tamperedToken, testSecret)).rejects.toThrow(JwtError);
      await expect(verifyToken(tamperedToken, testSecret)).rejects.toThrow(
        'Invalid token signature'
      );
    });

    it('rejects tokens with wrong secret', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const token = await createToken(payload, testSecret);

      await expect(verifyToken(token, 'wrong-secret-key')).rejects.toThrow(JwtError);
    });

    it('rejects malformed tokens', async () => {
      await expect(verifyToken('not-a-jwt', testSecret)).rejects.toThrow(JwtError);
      await expect(verifyToken('not-a-jwt', testSecret)).rejects.toThrow('Invalid token format');
    });

    it('rejects tokens with invalid payload', async () => {
      // Create a token with invalid base64 payload
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidbase64.signature';

      await expect(verifyToken(invalidToken, testSecret)).rejects.toThrow(JwtError);
    });

    it('rejects tokens with missing required fields', async () => {
      // Create a minimal valid structure but with missing fields
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: 'user' })); // missing iat, exp, iss, type
      const signature = 'signature';

      const token = `${header}.${payload}.${signature}`;

      await expect(verifyToken(token, testSecret)).rejects.toThrow(JwtError);
    });

    it('rejects expired tokens', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = {
        sub: 'user-123',
        type: 'admin' as const,
        iat: pastTime - 3600,
        exp: pastTime,
      };
      const token = await createToken(payload, testSecret);

      await expect(verifyToken(token, testSecret)).rejects.toThrow(JwtError);
      await expect(verifyToken(token, testSecret)).rejects.toThrow('Token has expired');
    });

    it('accepts tokens with valid future expiration', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = {
        sub: 'user-123',
        type: 'admin' as const,
        exp: futureTime,
      };
      const token = await createToken(payload, testSecret);

      const decoded = await verifyToken(token, testSecret);
      expect(decoded.sub).toBe('user-123');
    });
  });

  describe('createAdminToken', () => {
    it('creates an admin token', async () => {
      const token = await createAdminToken('admin-user', testSecret);

      const decoded = await verifyToken(token, testSecret);
      expect(decoded.sub).toBe('admin-user');
      expect(decoded.type).toBe('admin');
    });

    it('sets default expiration to 24 hours', async () => {
      const token = await createAdminToken('admin-user', testSecret);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
    });
  });

  describe('createServiceToken', () => {
    it('creates a service token', async () => {
      const token = await createServiceToken('worker-1', testSecret);

      const decoded = await verifyToken(token, testSecret);
      expect(decoded.sub).toBe('worker-1');
      expect(decoded.type).toBe('service');
    });

    it('uses 1 hour default expiration', async () => {
      const token = await createServiceToken('worker-1', testSecret);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.exp - decoded.iat).toBe(1 * 3600);
    });

    it('respects custom expiration in hours', async () => {
      const token = await createServiceToken('worker-1', testSecret, 2);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.exp - decoded.iat).toBe(2 * 3600);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('extracts token from Bearer header', () => {
      const token = 'my-jwt-token';
      const header = `Bearer ${token}`;

      expect(extractTokenFromHeader(header)).toBe(token);
    });

    it('handles lowercase bearer', () => {
      const token = 'my-jwt-token';
      const header = `bearer ${token}`;

      expect(extractTokenFromHeader(header)).toBe(token);
    });

    it('handles mixed case', () => {
      const token = 'my-jwt-token';
      const header = `BEARER ${token}`;

      expect(extractTokenFromHeader(header)).toBe(token);
    });

    it('handles extra spaces', () => {
      const token = 'my-jwt-token';
      const header = `Bearer  ${token}`;

      expect(extractTokenFromHeader(header)).toBe(token);
    });

    it('returns null for missing header', () => {
      expect(extractTokenFromHeader(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractTokenFromHeader('')).toBeNull();
    });

    it('returns null for header without Bearer', () => {
      expect(extractTokenFromHeader('Basic dXNlcjpwYXNz')).toBeNull();
    });

    it('returns null for Bearer without token', () => {
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Bearer  ')).toBeNull();
    });
  });

  describe('authenticateRequest', () => {
    it('authenticates valid request', async () => {
      const payload = { sub: 'user-123', type: 'admin' as const };
      const token = await createToken(payload, testSecret);
      const header = `Bearer ${token}`;

      const decoded = await authenticateRequest(header, testSecret);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.type).toBe('admin');
    });

    it('throws error for missing token', async () => {
      await expect(authenticateRequest(null, testSecret)).rejects.toThrow(JwtError);
      await expect(authenticateRequest(null, testSecret)).rejects.toThrow('No token provided');
    });

    it('throws error for empty header', async () => {
      await expect(authenticateRequest('', testSecret)).rejects.toThrow(JwtError);
    });

    it('throws error for invalid token format', async () => {
      await expect(authenticateRequest('Bearer invalid', testSecret)).rejects.toThrow(JwtError);
    });
  });

  describe('JwtError', () => {
    it('creates error with correct properties', () => {
      const error = new JwtError('Test error', 'INVALID_TOKEN');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INVALID_TOKEN');
      expect(error.name).toBe('JwtError');
    });

    it('supports all error codes', () => {
      const codes: Array<'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'MALFORMED_TOKEN'> = [
        'INVALID_TOKEN',
        'EXPIRED_TOKEN',
        'MALFORMED_TOKEN',
      ];

      codes.forEach((code) => {
        const error = new JwtError('Test', code);
        expect(error.code).toBe(code);
      });
    });

    it('is instanceof Error', () => {
      const error = new JwtError('Test', 'INVALID_TOKEN');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof JwtError).toBe(true);
    });
  });

  describe('security edge cases', () => {
    it('handles very long subjects', async () => {
      const longSub = 'a'.repeat(1000);
      const token = await createToken({ sub: longSub, type: 'admin' }, testSecret);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.sub).toBe(longSub);
    });

    it('handles special characters in subject', async () => {
      const specialSub = "user@example.com!#$%&'*+-/=?^_`{|}~";
      const token = await createToken({ sub: specialSub, type: 'admin' }, testSecret);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.sub).toBe(specialSub);
    });

    it('handles unicode in subject', async () => {
      const unicodeSub = 'user-café-演示';
      const token = await createToken({ sub: unicodeSub, type: 'admin' }, testSecret);
      const decoded = await verifyToken(token, testSecret);

      expect(decoded.sub).toBe(unicodeSub);
    });
  });
});
