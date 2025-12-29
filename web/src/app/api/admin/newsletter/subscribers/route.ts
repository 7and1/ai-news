import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getEnv } from '@/lib/d1';
import { listSubscribers } from '@/lib/db/newsletter-queries';
import { compareSecrets } from '@/lib/security/timing';
/**
 * GET /api/admin/newsletter/subscribers
 *
 * List all newsletter subscribers (protected endpoint)
 *
 * Requires admin authentication via X-Admin-Key header
 *
 * Query params:
 * - limit: number of results per page (default: 50)
 * - offset: pagination offset (default: 0)
 * - status: "all" | "active" | "unsubscribed" (default: "all")
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
    const status = searchParams.get('status') as 'all' | 'active' | 'unsubscribed' | null;

    const result = await listSubscribers({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status: status || undefined,
    });

    return NextResponse.json({
      success: true,
      subscribers: result.items.map((s) => ({
        id: s.id,
        email: s.email,
        confirmed: s.confirmed,
        preferences: s.preferences,
        subscribedAt: s.subscribedAt,
        unsubscribedAt: s.unsubscribedAt,
        sendCount: s.sendCount,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error('[Newsletter Subscribers] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
