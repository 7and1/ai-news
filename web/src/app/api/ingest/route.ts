import { revalidatePath } from 'next/cache';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { toSafeHtml, type ContentFormat } from '@/lib/content';
import { getDb } from '@/lib/d1';
import { linkNewsToCompany, linkNewsToTopic, upsertCompany, upsertTopic } from '@/lib/db/pseo-queries';
import { upsertNews } from '@/lib/db/queries';
import { entitySlugToName, extractEntities } from '@/lib/entities';
import { idFromUrl } from '@/lib/id';
import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import {
  BusinessMetrics,
  reportError,
  incrementCounter,
  logger,
  setCorrelationId,
  generateCorrelationId,
} from '@/lib/monitoring';
import { ingestBodySchema } from '@/lib/validation/schemas';

function stripHtmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Ensures a source exists in the database, creating it if necessary.
 */
async function ensureSource(input: {
  sourceId: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceCategory?: string | null;
  sourceLanguage?: string | null;
}): Promise<void> {
  const db = await getDb();
  const existing = await db
    .prepare('SELECT 1 FROM sources WHERE id = ? LIMIT 1')
    .bind(input.sourceId)
    .first();

  if (existing) {return;}

  if (!input.sourceName || !input.sourceUrl || !input.sourceType) {
    throw new Error(
      `Unknown source '${input.sourceId}'. Provide sourceName/sourceUrl/sourceType or pre-seed sources.`
    );
  }

  await db
    .prepare(
      `
      INSERT INTO sources (id, name, url, type, category, language, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `
    )
    .bind(
      input.sourceId,
      input.sourceName,
      input.sourceUrl,
      input.sourceType,
      input.sourceCategory ?? null,
      input.sourceLanguage ?? null,
      Date.now()
    )
    .run();
}

/**
 * Ingests a news article into the database.
 *
 * POST /api/ingest
 *
 * Headers:
 *   x-ingest-secret: Shared secret for authentication
 *   Authorization: Bearer <secret> (alternative to x-ingest-secret)
 *
 * Rate limiting: 10 requests per minute per IP
 */
export const POST = createMiddleware(
  {
    requireSecret: { key: 'INGEST_SECRET' },
    rateLimit: 'INGEST',
    securityHeaders: true,
    cors: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    // Set up request context for monitoring
    const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
    setCorrelationId(correlationId);

    // Validate request body
    let body;
    try {
      const json = await request.json();
      body = ingestBodySchema.parse(json);
    } catch (error) {
      if (error instanceof Error) {
        throw new ValidationError(
          error instanceof Error && 'flatten' in error
            ? (error as { flatten: () => unknown }).flatten()
            : error.message
        );
      }
      throw new ValidationError('Invalid request body');
    }

    try {
      // Ensure source exists
      await ensureSource({
        sourceId: body.sourceId,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        sourceType: body.sourceType,
        sourceCategory: body.sourceCategory ?? null,
        sourceLanguage: body.sourceLanguage ?? body.language ?? null,
      });

      // Generate ID and process content
      const id = body.id ?? idFromUrl(body.url);
      const crawledAt = body.crawledAt ?? Date.now();
      const content =
        body.content && body.content.trim()
          ? toSafeHtml(body.content, (body.contentFormat ?? 'markdown') as ContentFormat)
          : null;

      const entityText = [
        body.title,
        body.oneLine ?? '',
        body.summary ?? '',
        content ? stripHtmlToText(content) : '',
      ]
        .filter(Boolean)
        .join(' ');
      const entities = extractEntities(entityText);

      // Upsert news article
      const result = await upsertNews({
        id,
        url: body.url,
        title: body.title,
        summary: body.summary ?? null,
        oneLine: body.oneLine ?? null,
        content,
        sourceId: body.sourceId,
        category: body.category ?? null,
        tags: body.tags ?? [],
        importance: body.importance ?? 50,
        sentiment: body.sentiment ?? null,
        language: body.language ?? null,
        ogImage: body.ogImage ?? null,
        publishedAt: body.publishedAt,
        crawledAt,
        entities,
      });

      // Update pSEO link tables (best-effort; don't fail ingest on pSEO issues)
      try {
        for (const slug of entities.companies) {
          const { id: companyId } = await upsertCompany({
            slug,
            name: entitySlugToName(slug),
          });
          await linkNewsToCompany({ companyId, newsId: id, relevanceScore: 60 });
          revalidatePath(`/company/${slug}`);
        }

        const topicGroups: Array<{
          type: 'model' | 'technology' | 'concept';
          slugs: string[];
          relevanceScore: number;
        }> = [
          { type: 'model', slugs: entities.models, relevanceScore: 70 },
          { type: 'technology', slugs: entities.technologies, relevanceScore: 55 },
          { type: 'concept', slugs: entities.concepts, relevanceScore: 50 },
        ];

        for (const group of topicGroups) {
          for (const slug of group.slugs) {
            const { id: topicId } = await upsertTopic({
              slug,
              name: entitySlugToName(slug),
              type: group.type,
            });
            await linkNewsToTopic({ topicId, newsId: id, relevanceScore: group.relevanceScore });
            revalidatePath(`/topic/${slug}`);
          }
        }
      } catch (pseoError) {
        await reportError(pseoError, {
          endpoint: '/api/ingest',
          articleId: id,
          correlationId,
          note: 'pseo_linking_failed',
        });
      }

      // Track business metrics
      if (result.inserted) {
        await BusinessMetrics.articleCreated(body.sourceId, body.category ?? undefined);
      } else {
        await BusinessMetrics.articleUpdated();
      }
      await BusinessMetrics.ingestRequest(true);

      // Log the successful ingest
      await logger.info('Article ingested successfully', {
        articleId: id,
        sourceId: body.sourceId,
        inserted: result.inserted,
      });

      // Revalidate cached pages
      revalidatePath(`/news/${id}`);
      revalidatePath('/');
      revalidatePath('/latest');
      revalidatePath('/companies');
      revalidatePath('/topics');

      // Track metrics
      await incrementCounter('http_requests_total', 1, {
        method: 'POST',
        path: '/api/ingest',
        status: '2xx',
      });

      const response = NextResponse.json({
        ok: true,
        id,
        inserted: result.inserted,
        revalidated: true,
      });

      // Add correlation ID to response
      response.headers.set('x-correlation-id', correlationId);

      return response;
    } catch (err) {
      // Track error metrics
      await BusinessMetrics.ingestRequest(false);
      await incrementCounter('http_errors_total', 1, {
        method: 'POST',
        path: '/api/ingest',
        status: '500',
      });

      // Report error for tracking
      await reportError(err, {
        endpoint: '/api/ingest',
        sourceId: body?.sourceId,
        correlationId,
      });

      await logger.error('Ingest failed', {
        error: err instanceof Error ? err.message : String(err),
        sourceId: body?.sourceId,
      });

      return NextResponse.json(
        {
          error: 'ingest_failed',
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }
);

/**
 * OPTIONS handler for CORS preflight.
 */
export const OPTIONS = withSecurityHeaders(async (): Promise<NextResponse> => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ingest-Secret',
      'Access-Control-Max-Age': '86400',
    },
  });
});
