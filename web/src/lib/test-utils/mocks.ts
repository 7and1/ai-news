/**
 * Mock implementations for Cloudflare Workers environment.
 * These mocks allow tests to run without actual Cloudflare bindings.
 */

import type { AppEnv } from '../d1';

// Cloudflare Workers type definitions for testing
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[]; success: boolean; meta?: { duration?: number } }>;
  run(): Promise<{ success: boolean; meta: { changes: number; last_row_id?: number } }>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<
    {
      success: boolean;
      meta: { changes: number; last_row_id?: number | string; duration?: number };
      results?: unknown[];
    }[]
  >;
  exec(sql: string): Promise<{ success: boolean; meta: { duration: number } }>;
  dump(): Promise<ArrayBuffer>;
}

interface KVNamespace {
  get(
    key: string,
    options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ): Promise<string | null | R2Object | ReadableStream | Uint8Array>;
  put(
    key: string,
    value: string | ReadableStream | Uint8Array,
    options?: {
      expiration?: number;
      expirationTtl?: number;
      metadata?: unknown;
    }
  ): Promise<void>;
  delete(key: string | string[]): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2CustomMetadata {
  [key: string]: string;
}

interface R2Object {
  writeHttpMetadata(metadata: Headers | Partial<R2HTTPMetadata>): void;
  httpMetadata: R2HTTPMetadata;
  customMetadata: R2CustomMetadata;
  size: number;
  uploaded: Date;
  httpEtag: string;
  checksums: {
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha384?: string;
    sha512?: string;
  };
  range?: { offset: number; length: number };
}

interface R2PutValue {
  stream?: () => ReadableStream;
  blob?: () => Blob;
  arrayBuffer?: () => ArrayBuffer;
  text?: () => string;
  json?: () => unknown;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: R2PutValue | ReadableStream | ArrayBuffer | Uint8Array | string,
    options?: {
      httpMetadata?: R2HTTPMetadata;
      customMetadata?: R2CustomMetadata;
      sha256?: string;
    }
  ): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    delimiter?: string;
  }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      httpMetadata: R2HTTPMetadata;
      customMetadata: R2CustomMetadata;
    }>;
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes?: string[];
  }>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes?: string[];
}

declare global {
  var D1Database: D1Database;
  var KVNamespace: KVNamespace;
  var R2Bucket: R2Bucket;
  var R2Object: R2Object;
  var R2Objects: R2Objects;
  var R2HTTPMetadata: R2HTTPMetadata;
  var R2CustomMetadata: R2CustomMetadata;
}

/**
 * Mock D1 database result
 */
export class MockD1Result {
  constructor(
    public meta?: { changes: number; lastRowId?: number | string },
    public results?: unknown[]
  ) {}

  static single(value: unknown) {
    return new MockD1Result(undefined, [value]);
  }

  static empty() {
    return new MockD1Result({ changes: 0 }, []);
  }
}

/**
 * Mock D1 prepared statement
 */
export class MockD1PreparedStatement {
  private boundValues: unknown[] = [];

  constructor(
    private mockDb: MockD1Database,
    private sql: string
  ) {}

  bind(...values: unknown[]) {
    this.boundValues = values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    return this.mockDb.executeFirst(this.sql, this.boundValues) as T | null;
  }

  async all(): Promise<MockD1Result> {
    return this.mockDb.executeAll(this.sql, this.boundValues);
  }

  async run(): Promise<MockD1Result> {
    return this.mockDb.executeRun(this.sql, this.boundValues);
  }
}

/**
 * Mock D1 database
 */
export class MockD1Database implements D1Database {
  private data: Map<string, unknown[]> = new Map();
  private tables: Map<string, Map<string, unknown>> = new Map();

  constructor(initialData?: Record<string, unknown[]>) {
    if (initialData) {
      for (const [table, rows] of Object.entries(initialData)) {
        this.data.set(table, rows);
      }
    }
  }

  prepare(sql: string): D1PreparedStatement {
    return new MockD1PreparedStatement(this, sql) as unknown as D1PreparedStatement;
  }

  async executeFirst(sql: string, params: unknown[]): Promise<unknown | null> {
    const tableName = this.extractTableName(sql);
    if (!tableName) {
      return null;
    }

    const rows = this.data.get(tableName) || [];
    const id = params[0];

    if (sql.includes('WHERE') && id) {
      const row = rows.find((r: unknown) => (r as Record<string, unknown>).id === id);
      return row || null;
    }

    return rows[0] || null;
  }

  async executeAll(sql: string, _params: unknown[]): Promise<MockD1Result> {
    const tableName = this.extractTableName(sql);
    if (!tableName) {
      return new MockD1Result(undefined, []);
    }

    const rows = this.data.get(tableName) || [];
    return new MockD1Result(undefined, rows);
  }

  async executeRun(sql: string, _params: unknown[]): Promise<MockD1Result> {
    if (sql.includes('INSERT') || sql.includes('UPDATE')) {
      return new MockD1Result({ changes: 1, lastRowId: 'test-id' }, []);
    }
    return new MockD1Result({ changes: 0 }, []);
  }

  private extractTableName(sql: string): string | null {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const intoMatch = sql.match(/INTO\s+(\w+)/i);
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);

    return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || null;
  }

  // Missing D1Database methods
  async batch(statements: D1PreparedStatement[]): Promise<
    {
      success: boolean;
      meta: { changes: number; last_row_id?: number | string; duration?: number };
      results?: unknown[];
    }[]
  > {
    return statements.map(() => ({
      success: true,
      meta: { changes: 1, last_row_id: 'test-id' },
    }));
  }

  async exec(_sql: string): Promise<{ success: boolean; meta: { duration: number } }> {
    return { success: true, meta: { duration: 1 } };
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  // Set data for testing
  setTable(tableName: string, rows: unknown[]) {
    this.data.set(tableName, rows);
  }

  // Reset all data
  reset() {
    this.data.clear();
    this.tables.clear();
  }
}

/**
 * Mock KV namespace
 */
export class MockKVNamespace implements KVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(
    key: string,
    options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ): Promise<string | ReadableStream | Uint8Array | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiration && entry.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }

    if (options?.type === 'json') {
      return JSON.parse(entry.value);
    }
    if (options?.type === 'arrayBuffer') {
      return new TextEncoder().encode(entry.value);
    }
    if (options?.type === 'stream') {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(entry.value));
          controller.close();
        },
      });
    }
    return entry.value;
  }

  async put(
    key: string,
    value: string | ReadableStream | Uint8Array,
    options?: {
      expiration?: number;
      expirationTtl?: number;
      metadata?: unknown;
    }
  ): Promise<void> {
    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (value instanceof Uint8Array) {
      stringValue = new TextDecoder().decode(value);
    } else {
      // ReadableStream - read all chunks
      const reader = value.getReader();
      let result = '';
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        result += new TextDecoder().decode(chunk);
      }
      stringValue = result;
    }

    let expiration: number | undefined;
    if (options?.expiration) {
      expiration = options.expiration * 1000;
    } else if (options?.expirationTtl) {
      expiration = Date.now() + options.expirationTtl * 1000;
    }

    this.store.set(key, { value: stringValue, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    let keys = Array.from(this.store.keys());

    if (options?.prefix) {
      const prefix = options.prefix;
      keys = keys.filter((k) => k.startsWith(prefix));
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    return {
      keys: keys.map((name) => ({ name })),
      list_complete: true,
    };
  }

  // Test helpers
  getStore(): Map<string, { value: string; expiration?: number }> {
    return this.store;
  }

  reset() {
    this.store.clear();
  }
}

/**
 * Mock R2 object
 */
export class MockR2Object implements R2Object {
  httpEtag: string;
  range?: { offset: number; length: number };

  constructor(
    public httpMetadata: R2HTTPMetadata,
    public customMetadata: R2CustomMetadata,
    public size: number,
    public uploaded: Date,
    public checksums: {
      md5?: string;
      sha1?: string;
      sha256?: string;
      sha384?: string;
      sha512?: string;
    }
  ) {
    this.httpEtag = checksums.md5 || checksums.sha256 || 'mock-etag';
  }

  writeHttpMetadata(_metadata: Headers | Partial<R2HTTPMetadata>): void {
    // Implementation for test
  }
}

/**
 * Mock R2 bucket
 */
export class MockR2Bucket implements R2Bucket {
  private objects: Map<
    string,
    {
      data: ArrayBuffer;
      httpMetadata?: R2HTTPMetadata;
      customMetadata?: R2CustomMetadata;
    }
  > = new Map();

  async put(
    key: string,
    value: R2PutValue,
    options?: {
      httpMetadata?: R2HTTPMetadata;
      customMetadata?: R2CustomMetadata;
      sha256?: string;
    }
  ): Promise<R2Object> {
    let data: ArrayBuffer;

    if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(chunk);
      }
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const uint8Array = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        uint8Array.set(chunk, offset);
        offset += chunk.length;
      }
      data = uint8Array.buffer;
    } else if (value instanceof ArrayBuffer) {
      data = value;
    } else {
      data = new TextEncoder().encode(value as string).buffer;
    }

    this.objects.set(key, {
      data,
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });

    return new MockR2Object(
      options?.httpMetadata || {},
      options?.customMetadata || {},
      data.byteLength,
      new Date(),
      {}
    );
  }

  async get(key: string): Promise<R2Object | null> {
    const obj = this.objects.get(key);
    if (!obj) {
      return null;
    }

    return new MockR2Object(
      obj.httpMetadata || {},
      obj.customMetadata || {},
      obj.data.byteLength,
      new Date(),
      {}
    );
  }

  async delete(keys: string | string[]): Promise<void> {
    const keysToDelete = Array.isArray(keys) ? keys : [keys];
    for (const key of keysToDelete) {
      this.objects.delete(key);
    }
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    delimiter?: string;
  }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      httpMetadata: R2HTTPMetadata;
      customMetadata: R2CustomMetadata;
    }>;
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes?: string[];
  }> {
    let matchedKeys = Array.from(this.objects.keys());

    if (options?.prefix) {
      const prefix = options.prefix;
      matchedKeys = matchedKeys.filter((k) => k.startsWith(prefix));
    }

    if (options?.limit) {
      matchedKeys = matchedKeys.slice(0, options.limit);
    }

    return {
      objects: await Promise.all(
        matchedKeys.map(async (key) => {
          const obj = this.objects.get(key)!;
          return {
            key,
            size: obj.data.byteLength,
            uploaded: new Date(),
            httpMetadata: obj.httpMetadata || {},
            customMetadata: obj.customMetadata || {},
          };
        })
      ),
      truncated: false,
    };
  }

  // Test helpers
  reset() {
    this.objects.clear();
  }
}

/**
 * Create a mock environment with all Cloudflare bindings
 */
export function createMockEnv(overrides?: Partial<AppEnv>): AppEnv {
  return {
    DB: new MockD1Database() as unknown as D1Database,
    RATE_LIMIT_KV: new MockKVNamespace() as KVNamespace,
    LOGS: new MockKVNamespace() as KVNamespace,
    METRICS: new MockKVNamespace() as KVNamespace,
    ERROR_TRACKING: new MockKVNamespace() as KVNamespace,
    SITE_URL: 'http://localhost:3000',
    INGEST_SECRET: 'test-ingest-secret-min-32-chars-long',
    CRON_SECRET: 'test-cron-secret-min-32-chars-long',
    JWT_SECRET: 'test-jwt-secret-min-32-chars-long',
    RATE_LIMIT_ENABLED: 'true',
    ALLOWED_ORIGINS: '*',
    CSP_ENABLED: 'true',
    ...overrides,
  } as unknown as AppEnv;
}

/**
 * Mock Cloudflare context
 */
export function createMockCloudflareContext(env?: AppEnv) {
  return {
    env: env || createMockEnv(),
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        promise.catch(() => {});
      },
      passThroughOnException: () => {},
    },
  };
}
