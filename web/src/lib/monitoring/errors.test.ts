/**
 * Tests for error tracking utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../d1', () => ({
  getEnv: vi.fn(() => ({
    ERROR_TRACKING: {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
    },
  })),
}));

vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  setCorrelationId: vi.fn(),
  setRequestId: vi.fn(),
}));

import { getEnv } from '../d1';

import {
  reportError,
  resolveError,
  getError,
  listRecentErrors,
  getErrorStats,
  withErrorTracking,
  setupGlobalErrorHandler,
  HttpError,
  Errors,
} from './errors';
import { logger } from './logger';

describe('error tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockResolvedValue({
      ERROR_TRACKING: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
      } as unknown as KVNamespace,
    });
    vi.mocked(logger.error).mockResolvedValue(undefined);
  });

  describe('reportError', () => {
    it('reports error with context', async () => {
      const error = new Error('Test error');
      const context = { path: '/api/test', method: 'GET' };

      const fingerprint = await reportError(error, context);

      expect(fingerprint).toBeTruthy();
      expect(typeof fingerprint).toBe('string');
    });

    it('generates consistent fingerprint for same error', async () => {
      const error = new Error('Test error');

      const fp1 = await reportError(error);
      const fp2 = await reportError(error);

      expect(fp1).toBe(fp2);
    });

    it('handles Error objects', async () => {
      const error = new Error('Test error');

      const fingerprint = await reportError(error);

      expect(fingerprint).toMatch(/^fp_/);
    });

    it('handles string errors', async () => {
      const fingerprint = await reportError('String error');

      expect(fingerprint).toMatch(/^fp_/);
    });

    it('handles objects with message property', async () => {
      const error = { message: 'Object error', code: 'TEST_CODE' };

      const fingerprint = await reportError(error);

      expect(fingerprint).toMatch(/^fp_/);
    });

    it('stores error in KV', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      await reportError(new Error('Test'));

      expect(mockKV.put).toHaveBeenCalled();
    });

    it('increments count for recurring errors', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue({
          count: 3,
          firstSeen: Date.now() - 10000,
          lastSeen: Date.now() - 5000,
        }),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      await reportError(new Error('Recurring error'));

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('error:'),
        expect.stringContaining('"count":4'),
        expect.any(Object)
      );
    });

    it('includes context in stored error', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const context = { path: '/api/test', userId: 'user123' };
      await reportError(new Error('Test'), context);

      const putCall = mockKV.put.mock.calls[0];
      const storedData = JSON.parse(putCall[1]);

      expect(storedData.context).toEqual(context);
    });
  });

  describe('resolveError', () => {
    it('marks error as resolved', async () => {
      const mockError = {
        id: 'fp_test',
        message: 'Test error',
        resolved: false,
        count: 5,
      };

      const mockKV = {
        get: vi.fn().mockResolvedValue(mockError),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await resolveError('fp_test');

      expect(result).toBe(true);
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('returns false for non-existent error', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await resolveError('nonexistent');

      expect(result).toBe(false);
    });

    it('returns false when KV operation fails', async () => {
      const mockKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await resolveError('fp_test');

      expect(result).toBe(false);
    });
  });

  describe('getError', () => {
    it('retrieves error by fingerprint', async () => {
      const mockError = {
        id: 'fp_test',
        message: 'Test error',
        count: 5,
        resolved: false,
      };

      const mockKV = {
        get: vi.fn().mockResolvedValue(mockError),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await getError('fp_test');

      expect(result).toEqual(mockError);
    });

    it('returns null for non-existent error', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await getError('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when KV operation fails', async () => {
      const mockKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await getError('fp_test');

      expect(result).toBeNull();
    });
  });

  describe('listRecentErrors', () => {
    it('lists recent errors', async () => {
      const mockKeys = [{ name: 'error:fp_1' }, { name: 'error:fp_2' }, { name: 'error:fp_3' }];

      const mockErrors = [
        {
          id: 'fp_1',
          message: 'Error 1',
          resolved: false,
          lastSeen: Date.now(),
        },
        {
          id: 'fp_2',
          message: 'Error 2',
          resolved: false,
          lastSeen: Date.now() - 1000,
        },
        {
          id: 'fp_3',
          message: 'Error 3',
          resolved: true,
          lastSeen: Date.now() - 2000,
        },
      ];

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn((key) => {
          const id = key.replace('error:', '');
          return Promise.resolve(mockErrors.find((e) => e.id === id));
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await listRecentErrors({ limit: 10 });

      expect(result).toHaveLength(3);
    });

    it('filters by resolved status', async () => {
      const mockKeys = [{ name: 'error:fp_resolved' }, { name: 'error:fp_unresolved' }];

      const mockErrors = [
        {
          id: 'fp_resolved',
          message: 'Resolved error',
          resolved: true,
          lastSeen: Date.now(),
        },
        {
          id: 'fp_unresolved',
          message: 'Unresolved error',
          resolved: false,
          lastSeen: Date.now(),
        },
      ];

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn((key) => {
          const id = key.replace('error:', '');
          return Promise.resolve(mockErrors.find((e) => e.id === id));
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const unresolved = await listRecentErrors({ resolved: false });
      const resolved = await listRecentErrors({ resolved: true });

      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].resolved).toBe(false);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolved).toBe(true);
    });

    it('respects limit parameter', async () => {
      const mockKeys = Array.from({ length: 100 }, (_, i) => ({
        name: `error:fp_${i}`,
      }));

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn().mockResolvedValue({
          id: 'fp_test',
          message: 'Test',
          resolved: false,
          lastSeen: Date.now(),
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await listRecentErrors({ limit: 10 });

      // Should fetch more keys than limit due to filtering, but return limited results
      expect(mockKV.list).toHaveBeenCalledWith({ prefix: 'error:' });
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('returns empty array on error', async () => {
      const mockKV = {
        list: vi.fn().mockRejectedValue(new Error('KV error')),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await listRecentErrors();

      expect(result).toEqual([]);
    });

    it('sorts by lastSeen descending', async () => {
      const mockKeys = [{ name: 'error:fp_1' }, { name: 'error:fp_2' }, { name: 'error:fp_3' }];

      const now = Date.now();
      const mockErrors = [
        { id: 'fp_1', message: 'Error 1', resolved: false, lastSeen: now - 3000 },
        { id: 'fp_2', message: 'Error 2', resolved: false, lastSeen: now },
        { id: 'fp_3', message: 'Error 3', resolved: false, lastSeen: now - 1000 },
      ];

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn((key) => {
          const id = key.replace('error:', '');
          return Promise.resolve(mockErrors.find((e) => e.id === id));
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const result = await listRecentErrors({ limit: 10 });

      expect(result[0].id).toBe('fp_2'); // Most recent
      expect(result[1].id).toBe('fp_3');
      expect(result[2].id).toBe('fp_1'); // Least recent
    });
  });

  describe('getErrorStats', () => {
    it('calculates error statistics', async () => {
      const mockKeys = [{ name: 'error:fp_1' }, { name: 'error:fp_2' }, { name: 'error:fp_3' }];

      const mockErrors = [
        { id: 'fp_1', name: 'TypeError', resolved: false },
        { id: 'fp_2', name: 'TypeError', resolved: true },
        { id: 'fp_3', name: 'ReferenceError', resolved: false },
      ];

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn((key) => {
          const id = key.replace('error:', '');
          return Promise.resolve(mockErrors.find((e) => e.id === id));
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const stats = await getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.unresolved).toBe(2);
      expect(stats.byType).toEqual({
        TypeError: 2,
        ReferenceError: 1,
      });
      expect(stats.topErrors).toHaveLength(3);
    });

    it('returns default stats on error', async () => {
      const mockKV = {
        list: vi.fn().mockRejectedValue(new Error('KV error')),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const stats = await getErrorStats();

      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.topErrors).toEqual([]);
    });

    it('sorts top errors by count', async () => {
      const mockKeys = [{ name: 'error:fp_1' }, { name: 'error:fp_2' }, { name: 'error:fp_3' }];

      const mockErrors = [
        { id: 'fp_1', name: 'Error', count: 10, message: 'Error 1' },
        { id: 'fp_2', name: 'Error', count: 5, message: 'Error 2' },
        { id: 'fp_3', name: 'Error', count: 15, message: 'Error 3' },
      ];

      const mockKV = {
        list: vi.fn().mockResolvedValue({ keys: mockKeys }),
        get: vi.fn((key) => {
          const id = key.replace('error:', '');
          return Promise.resolve(mockErrors.find((e) => e.id === id));
        }),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const stats = await getErrorStats();

      expect(stats.topErrors[0].count).toBe(15);
      expect(stats.topErrors[1].count).toBe(10);
      expect(stats.topErrors[2].count).toBe(5);
    });
  });

  describe('withErrorTracking', () => {
    it('wraps function with error tracking', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const fn = vi.fn().mockResolvedValue('result');
      const wrapped = withErrorTracking(fn, { operation: 'test' });

      const result = await wrapped('arg1', 'arg2');

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('reports errors and re-throws', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const fn = vi.fn().mockRejectedValue(new Error('Function failed'));
      const wrapped = withErrorTracking(fn, { operation: 'test' });

      await expect(wrapped()).rejects.toThrow('Function failed');
      expect(mockKV.put).toHaveBeenCalled();
    });
  });

  describe('HttpError', () => {
    it('creates error with status code', () => {
      const error = new HttpError(404, 'Not Found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.name).toBe('HttpError');
    });

    it('creates error with code', () => {
      const error = new HttpError(409, 'Conflict', 'CONFLICT');

      expect(error.code).toBe('CONFLICT');
    });

    it('is instanceof Error', () => {
      const error = new HttpError(500, 'Server Error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof HttpError).toBe(true);
    });
  });

  describe('Errors factory', () => {
    it('creates bad request error', () => {
      const error = Errors.badRequest();

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('creates unauthorized error', () => {
      const error = Errors.unauthorized();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('creates forbidden error', () => {
      const error = Errors.forbidden();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('creates not found error', () => {
      const error = Errors.notFound();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('creates conflict error', () => {
      const error = Errors.conflict();

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('creates too many requests error', () => {
      const error = Errors.tooManyRequests();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('creates internal error', () => {
      const error = Errors.internal();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('creates service unavailable error', () => {
      const error = Errors.serviceUnavailable();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('accepts custom messages', () => {
      const error = Errors.notFound('Custom Resource');

      expect(error.message).toBe('Custom Resource');
    });
  });

  describe('setupGlobalErrorHandler', () => {
    it('sets up unhandledrejection handler', () => {
      const addEventListenerSpy = vi.spyOn(self, 'addEventListener');

      setupGlobalErrorHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('sets up error handler', () => {
      const addEventListenerSpy = vi.spyOn(self, 'addEventListener');

      setupGlobalErrorHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('does not throw when self is undefined', () => {
      // In environments where self is not defined
      const originalSelf = global.self;
      // @ts-expect-error - Testing undefined case
      delete global.self;

      expect(() => setupGlobalErrorHandler()).not.toThrow();

      global.self = originalSelf;
    });
  });

  describe('fingerprint generation', () => {
    it('generates same fingerprint for similar messages', async () => {
      const error1 = new Error('User 123 not found');
      const error2 = new Error('User 456 not found');

      const fp1 = await reportError(error1);
      const fp2 = await reportError(error2);

      // IDs should be normalized to "N" in fingerprint
      expect(fp1).toBe(fp2);
    });

    it('generates different fingerprints for different errors', async () => {
      const error1 = new Error('Database connection failed');
      const error2 = new Error('Network timeout');

      const fp1 = await reportError(error1);
      const fp2 = await reportError(error2);

      expect(fp1).not.toBe(fp2);
    });
  });

  describe('edge cases', () => {
    it('handles error with no message', async () => {
      const error = new Error();
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const fingerprint = await reportError(error);

      expect(fingerprint).toBeTruthy();
    });

    it('handles error with no stack', async () => {
      const error = { message: 'Test' };
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getEnv).mockResolvedValue({
        ERROR_TRACKING: mockKV as unknown as KVNamespace,
      });

      const fingerprint = await reportError(error);

      expect(fingerprint).toBeTruthy();
    });

    it('handles very long error messages', async () => {
      const longMessage = 'x'.repeat(10000);
      const error = new Error(longMessage);

      const fingerprint = await reportError(error);

      expect(fingerprint).toBeTruthy();
    });

    it('handles special characters in error messages', async () => {
      const error = new Error('Test\nwith\t\r"\'special\\chars');

      const fingerprint = await reportError(error);

      expect(fingerprint).toBeTruthy();
    });
  });
});
