import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddleware, withSecurityHeaders, ValidationError } from '@/lib/middleware';
import { revalidateBodySchema } from '@/lib/validation/schemas';

/**
 * Triggers cache revalidation for specific paths.
 *
 * POST /api/revalidate
 *
 * Headers:
 *   x-cron-secret: Shared secret for cron authentication
 *   Authorization: Bearer <secret> (alternative to x-cron-secret)
 *
 * Body:
 *   type: "news" | "all" - Revalidation type
 *   id: Article ID (required if type is "news")
 *
 * Rate limiting: Uses INGEST tier for cron endpoints
 */
export const POST = createMiddleware(
  {
    requireSecret: { key: 'CRON_SECRET' },
    rateLimit: 'INGEST',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    // Validate request body
    const json = await request.json().catch(() => null);
    const parsed = revalidateBodySchema.safeParse(json);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const { type, id } = parsed.data;

    try {
      if (type === 'news' && id) {
        revalidatePath(`/news/${id}`);
        revalidatePath('/');
        revalidatePath('/latest');
        revalidatePath('/companies');
      } else {
        revalidatePath('/');
        revalidatePath('/latest');
        revalidatePath('/companies');
      }

      return NextResponse.json({
        revalidated: true,
        now: Date.now(),
        type,
        id,
      });
    } catch {
      return NextResponse.json({ error: 'revalidate_failed' }, { status: 500 });
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
