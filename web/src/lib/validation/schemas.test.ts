/**
 * Tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  newsListQuerySchema,
  searchQuerySchema,
  ingestBodySchema,
  adminSourceUpdateSchema,
  revalidateBodySchema,
  jwtPayloadSchema,
  adminLoginSchema,
  formatValidationError,
  validateQuery,
  sanitizeString,
  validateTags,
  categoryEnum,
  languageEnum,
  sourceTypeEnum,
  contentFormatEnum,
  paginationSchema,
  dateRangeSchema,
  schemas,
} from './schemas';

describe('validation schemas', () => {
  describe('newsListQuerySchema', () => {
    const validData = {
      limit: '20',
      cursor: 'abc123',
      minImportance: '50',
      language: 'en',
      category: 'Artificial_Intelligence',
      sourceCategory: 'ai',
      tag: 'openai',
    };

    it('validates valid query parameters', () => {
      const result = newsListQuerySchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.minImportance).toBe(50);
        expect(result.data.language).toBe('en');
      }
    });

    it('allows optional fields', () => {
      const result = newsListQuerySchema.safeParse({ limit: '10' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.minImportance).toBeUndefined();
        expect(result.data.language).toBeUndefined();
      }
    });

    it('validates language enum', () => {
      const validLanguages = ['en', 'zh', 'es', 'fr', 'de', 'ja'];

      for (const lang of validLanguages) {
        const result = newsListQuerySchema.safeParse({ limit: '10', language: lang });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid language', () => {
      const result = newsListQuerySchema.safeParse({ limit: '10', language: 'invalid' });

      expect(result.success).toBe(false);
    });

    it('trims whitespace from strings', () => {
      const result = newsListQuerySchema.safeParse({
        limit: '10',
        category: '  Artificial_Intelligence  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('Artificial_Intelligence');
      }
    });

    it('validates minImportance range', () => {
      const result = newsListQuerySchema.safeParse({ limit: '10', minImportance: '150' });

      expect(result.success).toBe(false);
    });

    it('validates limit as positive integer', () => {
      const result = newsListQuerySchema.safeParse({ limit: '-5' });

      expect(result.success).toBe(false);
    });

    it('accepts zero for minImportance', () => {
      const result = newsListQuerySchema.safeParse({ limit: '10', minImportance: '0' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minImportance).toBe(0);
      }
    });
  });

  describe('searchQuerySchema', () => {
    it('validates valid search query', () => {
      const result = searchQuerySchema.safeParse({
        q: 'GPT-4',
        limit: '20',
        cursor: 'xyz',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('GPT-4');
      }
    });

    it('defaults q to empty string', () => {
      const result = searchQuerySchema.safeParse({ limit: '10' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('');
      }
    });

    it('trims query string', () => {
      const result = searchQuerySchema.safeParse({ q: '  GPT-4  ' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('GPT-4');
      }
    });

    it('enforces max query length', () => {
      const result = searchQuerySchema.safeParse({ q: 'x'.repeat(501) });

      expect(result.success).toBe(false);
    });

    it('accepts max length query', () => {
      const result = searchQuerySchema.safeParse({ q: 'x'.repeat(500) });

      expect(result.success).toBe(true);
    });
  });

  describe('ingestBodySchema', () => {
    const validData = {
      url: 'https://example.com/article',
      title: 'Test Article',
      sourceId: 'test-source',
      publishedAt: 1704067200000,
    };

    it('validates required fields', () => {
      const result = ingestBodySchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(validData.url);
        expect(result.data.title).toBe(validData.title);
        expect(result.data.sourceId).toBe(validData.sourceId);
        expect(result.data.publishedAt).toBe(validData.publishedAt);
      }
    });

    it('validates URL format', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        url: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });

    it('accepts valid URLs', () => {
      const urls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.com/path?query=value',
      ];

      for (const url of urls) {
        const result = ingestBodySchema.safeParse({ ...validData, url });
        expect(result.success).toBe(true);
      }
    });

    it('validates max URL length', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        url: `https://example.com/${'x'.repeat(2000)}`,
      });

      expect(result.success).toBe(false);
    });

    it('validates publishedAt is positive integer', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        publishedAt: -1000,
      });

      expect(result.success).toBe(false);
    });

    it('validates publishedAt is not too far in future', () => {
      const futureDate = Date.now() + 86400000 * 2; // 2 days from now

      const result = ingestBodySchema.safeParse({
        ...validData,
        publishedAt: futureDate,
      });

      expect(result.success).toBe(false);
    });

    it('allows optional fields', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        summary: 'Test summary',
        oneLine: 'Test one-line',
        content: 'Test content',
        importance: 75,
        language: 'en',
      });

      expect(result.success).toBe(true);
    });

    it('validates importance range', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        importance: 150,
      });

      expect(result.success).toBe(false);
    });

    it('validates tags array', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        tags: ['openai', 'gpt-4', 'ai'],
      });

      expect(result.success).toBe(true);
    });

    it('validates max tags count', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        tags: Array.from({ length: 25 }, (_, i) => `tag${i}`),
      });

      expect(result.success).toBe(false);
    });

    it('validates contentFormat enum', () => {
      const formats = ['markdown', 'html', 'text'];

      for (const format of formats) {
        const result = ingestBodySchema.safeParse({
          ...validData,
          contentFormat: format,
        });
        expect(result.success).toBe(true);
      }
    });

    it('validates language code length', () => {
      const result = ingestBodySchema.safeParse({
        ...validData,
        language: 'eng', // Should be 2 chars
      });

      expect(result.success).toBe(false);
    });
  });

  describe('adminSourceUpdateSchema', () => {
    const validData = {
      id: 'source-1',
      crawledAt: 1704067200000,
      success: true,
    };

    it('validates valid source update', () => {
      const result = adminSourceUpdateSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('allows optional errorCountDelta', () => {
      const result = adminSourceUpdateSchema.safeParse({
        ...validData,
        errorCountDelta: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.errorCountDelta).toBe(5);
      }
    });
  });

  describe('revalidateBodySchema', () => {
    it("defaults type to 'all'", () => {
      const result = revalidateBodySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('all');
      }
    });

    it('validates type enum', () => {
      const result = revalidateBodySchema.safeParse({ type: 'news' });

      expect(result.success).toBe(true);
    });

    it('allows optional id', () => {
      const result = revalidateBodySchema.safeParse({
        type: 'news',
        id: 'article-123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('jwtPayloadSchema', () => {
    const validPayload = {
      sub: 'user-123',
      iat: 1704067200,
      exp: 1704153600,
      iss: 'bestblogs.dev',
      type: 'admin' as const,
    };

    it('validates valid JWT payload', () => {
      const result = jwtPayloadSchema.safeParse(validPayload);

      expect(result.success).toBe(true);
    });

    it('validates type enum', () => {
      const types = ['admin', 'service'] as const;

      for (const type of types) {
        const result = jwtPayloadSchema.safeParse({
          ...validPayload,
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('requires all fields', () => {
      const result = jwtPayloadSchema.safeParse({ sub: 'user' });

      expect(result.success).toBe(false);
    });
  });

  describe('adminLoginSchema', () => {
    it('validates valid login', () => {
      const result = adminLoginSchema.safeParse({
        username: 'admin',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('validates username min length', () => {
      const result = adminLoginSchema.safeParse({
        username: 'ab',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('validates password min length', () => {
      const result = adminLoginSchema.safeParse({
        username: 'admin',
        password: 'pass',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('enum schemas', () => {
    describe('categoryEnum', () => {
      const validCategories = [
        'Artificial_Intelligence',
        'Business_Tech',
        'Programming_Technology',
        'Product_Development',
        'Design',
        'Career_Growth',
      ];

      it('accepts all valid categories', () => {
        for (const category of validCategories) {
          const result = categoryEnum.safeParse(category);
          expect(result.success).toBe(true);
        }
      });

      it('rejects invalid categories', () => {
        const result = categoryEnum.safeParse('Invalid_Category');

        expect(result.success).toBe(false);
      });
    });

    describe('languageEnum', () => {
      const validLanguages = ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar'];

      it('accepts all valid languages', () => {
        for (const lang of validLanguages) {
          const result = languageEnum.safeParse(lang);
          expect(result.success).toBe(true);
        }
      });

      it('rejects invalid languages', () => {
        const result = languageEnum.safeParse('xx');

        expect(result.success).toBe(false);
      });
    });

    describe('sourceTypeEnum', () => {
      const validTypes = ['article', 'podcast', 'twitter', 'video'];

      it('accepts all valid types', () => {
        for (const type of validTypes) {
          const result = sourceTypeEnum.safeParse(type);
          expect(result.success).toBe(true);
        }
      });

      it('rejects invalid types', () => {
        const result = sourceTypeEnum.safeParse('blog');

        expect(result.success).toBe(false);
      });
    });

    describe('contentFormatEnum', () => {
      const validFormats = ['markdown', 'html', 'text'];

      it('accepts all valid formats', () => {
        for (const format of validFormats) {
          const result = contentFormatEnum.safeParse(format);
          expect(result.success).toBe(true);
        }
      });
    });
  });

  describe('paginationSchema', () => {
    it('validates limit parameter', () => {
      const result = paginationSchema.safeParse({ limit: '20' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('allows optional cursor', () => {
      const result = paginationSchema.safeParse({
        limit: '10',
        cursor: 'eyJ0ZXN0IjoidmFsdWUifQ',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('dateRangeSchema', () => {
    it('transforms date strings to timestamps', () => {
      const result = dateRangeSchema.safeParse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBeDefined();
        expect(result.data.endDate).toBeDefined();
        expect(typeof result.data.startDate).toBe('number');
      }
    });

    it('handles invalid dates', () => {
      const result = dateRangeSchema.safeParse({
        startDate: 'not-a-date',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('helper functions', () => {
    describe('formatValidationError', () => {
      it('formats Zod error correctly', () => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().min(18),
        });

        const result = schema.safeParse({ email: 'invalid', age: 15 });

        if (!result.success) {
          const formatted = formatValidationError(result.error);

          expect(formatted).toHaveProperty('error', 'validation_error');
          expect(formatted).toHaveProperty('details');
          expect(typeof formatted.details).toBe('object');
        }
      });

      it('includes field errors', () => {
        const schema = z.object({
          name: z.string().min(3),
        });

        const result = schema.safeParse({ name: 'ab' });

        if (!result.success) {
          const formatted = formatValidationError(result.error);

          expect(formatted.details).toHaveProperty('name');
        }
      });
    });

    describe('validateQuery', () => {
      it('validates URLSearchParams', () => {
        const params = new URLSearchParams({
          limit: '20',
          language: 'en',
        });

        const result = validateQuery(params, searchQuerySchema);

        expect(result.limit).toBe(20);
        expect(result.language).toBeUndefined(); // Not in searchQuerySchema
      });
    });

    describe('sanitizeString', () => {
      it('escapes HTML characters', () => {
        const input = '<script>alert("xss")</script>';
        const sanitized = sanitizeString(input);

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('&lt;');
        expect(sanitized).toContain('&gt;');
      });

      it('escapes quotes', () => {
        const input = '"quoted" and \'single\'';
        const sanitized = sanitizeString(input);

        expect(sanitized).toContain('&quot;');
        expect(sanitized).toContain('&#x27;');
      });

      it('escapes forward slash', () => {
        const input = 'path/to/file';
        const sanitized = sanitizeString(input);

        expect(sanitized).toContain('&#x2F;');
      });

      it('handles empty string', () => {
        const sanitized = sanitizeString('');

        expect(sanitized).toBe('');
      });
    });

    describe('validateTags', () => {
      it('returns array of valid tags', () => {
        const tags = validateTags(['openai', 'gpt-4', 'ai']);

        expect(tags).toEqual(['openai', 'gpt-4', 'ai']);
      });

      it('filters empty tags', () => {
        const tags = validateTags(['valid', '', '  ', 'also-valid']);

        expect(tags).toEqual(['valid', 'also-valid']);
      });

      it('returns empty array for invalid input', () => {
        expect(validateTags(null)).toEqual([]);
        expect(validateTags(undefined)).toEqual([]);
        expect(validateTags('not-an-array')).toEqual([]);
      });

      it('limits max tags', () => {
        const tooMany = Array.from({ length: 25 }, (_, i) => `tag${i}`);
        const tags = validateTags(tooMany);

        expect(tags.length).toBeLessThanOrEqual(20);
      });

      it('trims tag whitespace', () => {
        const tags = validateTags([' openai ', '  gpt-4  ']);

        expect(tags).toEqual(['openai', 'gpt-4']);
      });
    });
  });

  describe('schemas export', () => {
    it('exports all schema groups', () => {
      expect(schemas).toHaveProperty('news');
      expect(schemas).toHaveProperty('search');
      expect(schemas).toHaveProperty('ingest');
      expect(schemas).toHaveProperty('admin');
      expect(schemas).toHaveProperty('revalidate');
      expect(schemas).toHaveProperty('auth');
      expect(schemas).toHaveProperty('pagination');
      expect(schemas).toHaveProperty('dateRange');
      expect(schemas).toHaveProperty('enums');
    });

    it('exports correct schemas', () => {
      expect(schemas.news.list).toBe(newsListQuerySchema);
      expect(schemas.search).toBe(searchQuerySchema);
      expect(schemas.ingest).toBe(ingestBodySchema);
    });
  });

  describe('edge cases', () => {
    it('handles null values in optional fields', () => {
      const result = ingestBodySchema.safeParse({
        url: 'https://example.com',
        title: 'Test',
        sourceId: 'test',
        publishedAt: 1704067200000,
        summary: null,
        tags: null,
      });

      expect(result.success).toBe(true);
    });

    it('handles very long string values', () => {
      const result = ingestBodySchema.safeParse({
        url: 'https://example.com',
        title: 'x'.repeat(1000),
        sourceId: 'test',
        publishedAt: 1704067200000,
      });

      expect(result.success).toBe(false);
    });

    it('handles special characters in strings', () => {
      const result = ingestBodySchema.safeParse({
        url: 'https://example.com',
        title: 'Test with émojis 🎉 and spëcial çhars',
        sourceId: 'test',
        publishedAt: 1704067200000,
      });

      expect(result.success).toBe(true);
    });

    it('handles numeric strings', () => {
      const result = newsListQuerySchema.safeParse({
        limit: '20',
        minImportance: '50',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.limit).toBe('number');
        expect(typeof result.data.minImportance).toBe('number');
      }
    });

    it('rejects non-numeric strings for numeric fields', () => {
      const result = newsListQuerySchema.safeParse({
        limit: 'not-a-number',
      });

      expect(result.success).toBe(false);
    });
  });
});
