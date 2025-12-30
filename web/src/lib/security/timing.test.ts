/**
 * Tests for timing-safe string comparison utilities
 */

import { describe, it, expect } from 'vitest';

import { timingSafeEqual, compareSecrets, hashSecret, verifySecretAgainstHash } from './timing';

describe('timing-safe comparison', () => {
  describe('timingSafeEqual', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false);
    });

    it('returns false for strings of different lengths', () => {
      expect(timingSafeEqual('hello', 'hello!')).toBe(false);
    });

    it('returns true for empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('returns false when one string is empty', () => {
      expect(timingSafeEqual('', 'hello')).toBe(false);
      expect(timingSafeEqual('hello', '')).toBe(false);
    });

    it('handles special characters', () => {
      expect(timingSafeEqual('test@example.com', 'test@example.com')).toBe(true);
      expect(timingSafeEqual('p@$$w0rd!', 'p@$$w0rd!')).toBe(true);
    });

    it('handles unicode characters', () => {
      expect(timingSafeEqual('hello world', 'hello world')).toBe(true);
      expect(timingSafeEqual('hello world', 'hello worId')).toBe(false);
    });

    it('is constant-time for same-length strings', () => {
      // This test ensures the function doesn't short-circuit on first character mismatch
      const times1: number[] = [];
      const times2: number[] = [];

      // Run many iterations to measure timing consistency
      for (let i = 0; i < 100; i++) {
        const start1 = performance.now();
        timingSafeEqual('aaaaaaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaa');
        times1.push(performance.now() - start1);

        const start2 = performance.now();
        timingSafeEqual('aaaaaaaaaaaaaaaaaaaa', 'baaaaaaaaaaaaaaaaaaa');
        times2.push(performance.now() - start2);
      }

      // The average difference should be minimal for constant-time comparison
      // (Note: This is a basic check; true constant-time verification requires more sophisticated tools)
      const avg1 = times1.reduce((a, b) => a + b, 0) / times1.length;
      const avg2 = times2.reduce((a, b) => a + b, 0) / times2.length;

      // Allow some tolerance for JS runtime variations
      expect(Math.abs(avg1 - avg2)).toBeLessThan(0.01);
    });
  });

  describe('compareSecrets', () => {
    it('returns true for matching secrets', () => {
      expect(compareSecrets('my-secret-key', 'my-secret-key')).toBe(true);
    });

    it('returns false for non-matching secrets', () => {
      expect(compareSecrets('my-secret-key', 'wrong-secret')).toBe(false);
    });

    it('returns false when candidate secret is null', () => {
      expect(compareSecrets('my-secret-key', null)).toBe(false);
    });

    it('returns false when candidate secret is undefined', () => {
      expect(compareSecrets('my-secret-key', undefined)).toBe(false);
    });

    it('returns false when actual secret is undefined', () => {
      expect(compareSecrets(undefined, 'my-secret-key')).toBe(false);
    });

    it('returns false when both secrets are undefined', () => {
      expect(compareSecrets(undefined, undefined)).toBe(false);
    });

    it('returns false when actual secret is null', () => {
      expect(compareSecrets(null, 'my-secret-key')).toBe(false);
    });

    it('returns false for empty string candidate', () => {
      expect(compareSecrets('my-secret-key', '')).toBe(false);
    });

    it('returns false for empty string actual', () => {
      expect(compareSecrets('', 'my-secret-key')).toBe(false);
    });

    it('handles string type conversion', () => {
      expect(compareSecrets('secret', 'secret')).toBe(true);
    });
  });

  describe('hashSecret', () => {
    it('hashes a secret string', async () => {
      const hash = await hashSecret('my-secret-key');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
    });

    it('produces consistent hashes for same input', async () => {
      const hash1 = await hashSecret('my-secret-key');
      const hash2 = await hashSecret('my-secret-key');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashSecret('my-secret-key');
      const hash2 = await hashSecret('different-secret');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', async () => {
      const hash = await hashSecret('');
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('handles special characters', async () => {
      const hash = await hashSecret('p@$$w0rd!#*&%');
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('handles long strings', async () => {
      const longSecret = 'a'.repeat(10000);
      const hash = await hashSecret(longSecret);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });
  });

  describe('verifySecretAgainstHash', () => {
    it('returns true for matching secret and hash', async () => {
      const secret = 'my-secret-key';
      const hash = await hashSecret(secret);
      expect(await verifySecretAgainstHash(secret, hash)).toBe(true);
    });

    it('returns false for non-matching secret and hash', async () => {
      const secret = 'my-secret-key';
      const hash = await hashSecret(secret);
      expect(await verifySecretAgainstHash('wrong-secret', hash)).toBe(false);
    });

    it('returns false for empty secret against non-empty hash', async () => {
      const hash = await hashSecret('my-secret-key');
      expect(await verifySecretAgainstHash('', hash)).toBe(false);
    });

    it('is timing-safe', async () => {
      const secret = 'my-secret-key';
      const hash = await hashSecret(secret);

      const times1: number[] = [];
      const times2: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start1 = performance.now();
        await verifySecretAgainstHash(secret, hash);
        times1.push(performance.now() - start1);

        const start2 = performance.now();
        await verifySecretAgainstHash('wrong', hash);
        times2.push(performance.now() - start2);
      }

      // Timing difference should be minimal
      const avg1 = times1.reduce((a, b) => a + b, 0) / times1.length;
      const avg2 = times2.reduce((a, b) => a + b, 0) / times2.length;

      expect(Math.abs(avg1 - avg2)).toBeLessThan(0.1);
    });
  });

  describe('edge cases and security', () => {
    it('handles very long secrets', () => {
      const longSecret1 = 'a'.repeat(1000);
      const longSecret2 = 'a'.repeat(999) + 'b';
      expect(timingSafeEqual(longSecret1, longSecret2)).toBe(false);
    });

    it('handles secrets with null bytes', () => {
      // JavaScript strings can contain null bytes
      const secret1 = 'test\x00secret';
      const secret2 = 'test\x00secret';
      expect(timingSafeEqual(secret1, secret2)).toBe(true);
    });

    it('is case-sensitive', () => {
      expect(timingSafeEqual('Secret', 'secret')).toBe(false);
      expect(timingSafeEqual('SECRET', 'secret')).toBe(false);
    });

    it('handles whitespace correctly', () => {
      expect(timingSafeEqual(' secret', 'secret')).toBe(false);
      expect(timingSafeEqual('secret ', 'secret')).toBe(false);
      expect(timingSafeEqual('secret', 'secret ')).toBe(false);
      expect(timingSafeEqual(' secret ', 'secret ')).toBe(false);
    });
  });
});
