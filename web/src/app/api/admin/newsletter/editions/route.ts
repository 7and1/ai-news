import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getEnv } from '@/lib/d1';
import { listNewsletterEditions } from '@/lib/db/newsletter-queries';
import { compareSecrets } from '@/lib/security/timing';
/**
 * GET /api/admin/newsletter/editions
 *
 * List newsletter editions (protected endpoint)
 *
 * Requires admin authentication via X-Admin-Key header
 *
 * Query params:
 * - limit: number of results per page (default: 20)
 * - offset: pagination offset (default: 0)
 * - status: filter by status
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const adminKey = request.headers.get('X-Admin-Key');
    const env = await getEnv();
    const expected = env.ADMIN_SECRET;

    if (!adminKey || !expected || !compareSecrets(expected, adminKey)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const status = searchParams.get('status');

    const result = await listNewsletterEditions({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status: (status as any) || undefined,
    });

    return NextResponse.json({
      success: true,
      editions: result.items.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        sentAt: e.sentAt,
        recipientCount: e.recipientCount,
        sentCount: e.sentCount,
        openCount: e.openCount,
        clickCount: e.clickCount,
        createdAt: e.createdAt,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error('[Newsletter Editions] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
