/**
 * Test setup file - runs before all tests
 */

import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Cloudflare Workers environment
function toBytes(data: BufferSource): Uint8Array {
  return ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
}

function mockHmacSha256(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  let sum = 0;
  for (const b of keyBytes) {
    sum = (sum + b) % 256;
  }
  for (const b of messageBytes) {
    sum = (sum + b) % 256;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] = (sum + i) % 256;
  }
  return out;
}

const mockedCrypto = {
  subtle: {
    digest: vi.fn(async (_algorithm: string, data: BufferSource) => {
      const input = toBytes(data);

      // Deterministic 32-byte digest (SHA-256 sized) for tests.
      const out = new Uint8Array(32);
      let sum = 0;
      for (const b of input) {
        sum = (sum + b) % 256;
      }
      for (let i = 0; i < out.length; i++) {
        out[i] = (sum + i) % 256;
      }
      return out.buffer;
    }),
    generateKey: vi.fn(),
    importKey: vi.fn(async (_format: string, keyData: BufferSource) => ({
      type: 'secret' as const,
      extractable: false,
      algorithm: { name: 'HMAC' },
      usages: ['sign', 'verify'] as KeyUsage[],
      __rawKey: toBytes(keyData),
    })),
    sign: vi.fn(async (_algorithm: unknown, key: unknown, data: BufferSource) => {
      const keyBytes = ((key as { __rawKey?: Uint8Array }).__rawKey ??
        new Uint8Array()) as Uint8Array;
      const messageBytes = toBytes(data);
      return mockHmacSha256(keyBytes, messageBytes).buffer;
    }),
    verify: vi.fn(
      async (_algorithm: unknown, key: unknown, signature: BufferSource, data: BufferSource) => {
        const keyBytes = ((key as { __rawKey?: Uint8Array }).__rawKey ??
          new Uint8Array()) as Uint8Array;
        const expected = mockHmacSha256(keyBytes, toBytes(data));
        const actual = toBytes(signature);
        if (actual.length !== expected.length) {
          return false;
        }
        for (let i = 0; i < actual.length; i++) {
          if (actual[i] !== expected[i]) {
            return false;
          }
        }
        return true;
      }
    ),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    deriveKey: vi.fn(),
    deriveBits: vi.fn(),
    wrapKey: vi.fn(),
    unwrapKey: vi.fn(),
    exportKey: vi.fn(),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  randomUUID: vi.fn(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }),
} as Crypto;

Object.defineProperty(globalThis, 'crypto', {
  value: mockedCrypto,
  configurable: true,
});

if (!('addEventListener' in globalThis)) {
  (globalThis as unknown as { addEventListener: (...args: unknown[]) => void }).addEventListener =
    vi.fn();
}
if (!('removeEventListener' in globalThis)) {
  (
    globalThis as unknown as { removeEventListener: (...args: unknown[]) => void }
  ).removeEventListener = vi.fn();
}
if (!('self' in globalThis)) {
  Object.defineProperty(globalThis, 'self', {
    value: globalThis,
    configurable: true,
  });
}

// Mock fetch for API tests
globalThis.fetch = vi.fn(async (_url: string | URL, _init?: RequestInit) => {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as unknown as typeof fetch;

// Mock environment setup
export function setupMockEnv() {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
}

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

export {};
