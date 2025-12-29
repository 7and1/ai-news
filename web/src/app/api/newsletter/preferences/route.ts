import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getSubscriberByUnsubscribeToken,
  updateSubscriberPreferences,
} from '@/lib/db/newsletter-queries';
import type { SubscriberPreferences } from '@/lib/db/newsletter-types';

const preferencesSchema = z.object({
  token: z.string(),
  preferences: z.object({
    categories: z.array(z.string()).optional(),
    frequency: z.enum(['daily', 'weekly', 'biweekly'] as const).optional(),
    language: z.enum(['en', 'zh'] as const).optional(),
  }),
});

/**
 * POST /api/newsletter/preferences
 *
 * Update subscriber preferences
 *
 * Request body:
 * {
 *   "token": "unsubscribe_token",
 *   "preferences": {
 *     "categories": ["Artificial_Intelligence", "Business_Tech"],
 *     "frequency": "weekly",
 *     "language": "en"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = preferencesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { token, preferences } = result.data;

    // Get subscriber by unsubscribe token (used for auth)
    const subscriber = await getSubscriberByUnsubscribeToken(token);

    if (!subscriber) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 404 });
    }

    // Update preferences
    const updated = await updateSubscriberPreferences(subscriber.id, {
      preferences: preferences as Partial<SubscriberPreferences>,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updated.preferences,
    });
  } catch (error) {
    console.error('[Newsletter Preferences] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * GET /api/newsletter/preferences?token=xxx
 *
 * Get subscriber preferences
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token parameter required' },
        { status: 400 }
      );
    }

    const subscriber = await getSubscriberByUnsubscribeToken(token);

    if (!subscriber) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      email: subscriber.email,
      preferences: subscriber.preferences,
    });
  } catch (error) {
    console.error('[Newsletter Preferences GET] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
