import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getEnv } from '@/lib/d1';
import { getNewsletterStats } from '@/lib/db/newsletter-queries';
import { compareSecrets } from '@/lib/security/timing';
/**
 * GET /api/admin/newsletter/stats
 *
 * Get newsletter statistics (protected endpoint)
 *
 * Requires admin authentication via X-Admin-Key header
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

    const stats = await getNewsletterStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Newsletter Stats] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
