/**
 * Centralized validation schemas using Zod.
 * Provides input validation for all API endpoints.
 */

import { z } from 'zod';

// Re-export z for use in other modules
export { z };

/**
 * Common validation helpers.
 */
const positiveInt = () =>
  z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().max(1000).optional());

const nonEmptyString = () => z.string().min(1).max(999);
const url = () => z.string().url().max(2000);
const id = () => z.string().min(4).max(50);

/**
 * News API validation schemas.
 */

/** Query parameters for /api/news listing endpoint */
export const newsListQuerySchema = z.object({
  limit: positiveInt(),
  cursor: z.string().optional(),
  minImportance: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(0).max(100).optional()),
  language: z.enum(['en', 'zh', 'es', 'fr', 'de', 'ja']).optional(),
  category: z
    .string()
    .optional()
    .transform((val) => val?.trim())
    .pipe(z.string().max(50).optional()),
  sourceCategory: z
    .string()
    .optional()
    .transform((val) => val?.trim())
    .pipe(z.string().max(50).optional()),
  tag: z
    .string()
    .optional()
    .transform((val) => val?.trim())
    .pipe(z.string().max(50).optional()),
});

/** Path parameters for /api/news/[id] endpoint */
export const newsByIdPathSchema = z.object({
  id: id(),
});

/**
 * Search API validation schemas.
 */

/** Query parameters for /api/search endpoint */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .optional()
    .default('')
    .transform((val) => val.trim())
    .pipe(z.string().max(500)),
  limit: positiveInt(),
  cursor: z.string().optional(),
});

/**
 * Ingest API validation schemas.
 */

/** Request body for /api/ingest endpoint */
export const ingestBodySchema = z.object({
  id: id().optional(),
  url: url(),
  title: nonEmptyString(),
  sourceId: z.string().min(1).max(100),
  publishedAt: z
    .number()
    .int()
    .positive()
    .max(Date.now() + 86400000),
  crawledAt: z
    .number()
    .int()
    .positive()
    .max(Date.now() + 86400000)
    .optional(),

  summary: z.string().max(5000).optional().nullable(),
  oneLine: z.string().max(500).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  contentFormat: z.enum(['markdown', 'html', 'text']).optional(),

  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().nullable(),
  importance: z.number().int().min(0).max(100).optional().nullable(),
  sentiment: z.string().max(50).optional().nullable(),
  language: z.string().length(2).optional().nullable(),
  ogImage: url().optional().nullable(),

  sourceName: z.string().max(200).optional(),
  sourceUrl: url().optional(),
  sourceType: z.string().max(50).optional(),
  sourceCategory: z.string().max(50).optional().nullable(),
  sourceLanguage: z.string().length(2).optional().nullable(),
});

/**
 * Admin API validation schemas.
 */

/** Request body for /api/admin/sources (update) endpoint */
export const adminSourceUpdateSchema = z.object({
  id: z.string().min(1).max(100),
  crawledAt: z
    .number()
    .int()
    .positive()
    .max(Date.now() + 86400000),
  success: z.boolean(),
  errorCountDelta: z.number().int().optional(),
});

/** Query parameters for /api/admin/sources (list) endpoint */
export const adminSourcesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 200))
    .pipe(z.number().int().positive().max(500)),
});

/**
 * Revalidate API validation schemas.
 */

/** Request body for /api/revalidate endpoint */
export const revalidateBodySchema = z.object({
  type: z.enum(['news', 'all']).optional().default('all'),
  id: z.string().min(4).max(50).optional(),
});

/**
 * Authentication validation schemas.
 */

/** JWT payload validation */
export const jwtPayloadSchema = z.object({
  sub: z.string(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  type: z.enum(['admin', 'service']),
});

/** Admin login request body (if implemented) */
export const adminLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(200),
});

/**
 * Generic error response schema.
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
});

/**
 * Validation error formatter.
 * Formats Zod errors into a consistent API response format.
 */
export function formatValidationError(error: z.ZodError): {
  error: string;
  details: Record<string, string | string[]>;
} {
  const details: Record<string, string | string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.');
    if (path) {
      details[path] = issue.message;
    }
  }

  return {
    error: 'validation_error',
    details,
  };
}

/**
 * Validates query parameters against a schema.
 * Returns typed data or throws a validation error.
 */
export function validateQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const rawParams: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    rawParams[key] = value;
  }
  return schema.parse(rawParams);
}

/**
 * Validates request body against a schema.
 * Returns typed data or throws a validation error.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const json = await request.json();
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new Error('invalid_json');
  }
}

/**
 * Validates path parameters against a schema.
 * Returns typed data or throws a validation error.
 */
export function validateParams<T extends z.ZodType>(
  params: Record<string, unknown>,
  schema: T
): z.infer<T> {
  return schema.parse(params);
}

/**
 * Sanitizes string input to prevent XSS attacks.
 * This is a basic sanitization - for HTML content, use the content library.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates and sanitizes an array of string tags.
 */
export function validateTags(tags: unknown): string[] {
  const tagSchema = z.array(z.string().min(1).max(50)).max(20);
  const cleaned = Array.isArray(tags)
    ? tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const parsed = tagSchema.safeParse(cleaned);

  if (!parsed.success) {
    return [];
  }

  return parsed.data;
}

/**
 * Validates a category enum value.
 */
export const categoryEnum = z.enum([
  'Artificial_Intelligence',
  'Business_Tech',
  'Programming_Technology',
  'Product_Development',
  'Design',
  'Career_Growth',
]);

/**
 * Validates a language code (ISO 639-1).
 */
export const languageEnum = z.enum(['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar']);

/**
 * Validates a source type.
 */
export const sourceTypeEnum = z.enum(['article', 'podcast', 'twitter', 'video']);

/**
 * Content format enum.
 */
export const contentFormatEnum = z.enum(['markdown', 'html', 'text']);

/**
 * Pagination parameters (cursor-based).
 */
export const paginationSchema = z.object({
  limit: positiveInt(),
  cursor: z.string().optional(),
});

/**
 * Date range validation.
 */
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val).getTime() : undefined))
    .pipe(z.number().int().positive().optional()),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val).getTime() : undefined))
    .pipe(z.number().int().positive().optional()),
});

/**
 * Export all schemas for use in API routes.
 */
export const schemas = {
  news: {
    list: newsListQuerySchema,
    byId: newsByIdPathSchema,
  },
  search: searchQuerySchema,
  ingest: ingestBodySchema,
  admin: {
    sourceUpdate: adminSourceUpdateSchema,
    sourcesQuery: adminSourcesQuerySchema,
  },
  revalidate: revalidateBodySchema,
  auth: {
    login: adminLoginSchema,
    jwt: jwtPayloadSchema,
  },
  pagination: paginationSchema,
  dateRange: dateRangeSchema,
  enums: {
    category: categoryEnum,
    language: languageEnum,
    sourceType: sourceTypeEnum,
    contentFormat: contentFormatEnum,
  },
};
