import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import {
  confirmSubscriber,
  getSubscriberByConfirmationToken,
  queueEmail,
} from '@/lib/db/newsletter-queries';
import { generateWelcomeEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/newsletter/confirm/:token
 *
 * Confirm a newsletter subscription using the token
 *
 * This endpoint confirms the subscription and sends a welcome email
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });
    }

    // Get subscriber by token
    const subscriber = await getSubscriberByConfirmationToken(token);

    if (!subscriber) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired confirmation token' },
        { status: 404 }
      );
    }

    if (subscriber.confirmed) {
      return NextResponse.json({
        success: true,
        message: 'Subscription already confirmed',
      });
    }

    // Confirm the subscription
    const confirmed = await confirmSubscriber(token);

    if (!confirmed) {
      return NextResponse.json(
        { success: false, error: 'Failed to confirm subscription' },
        { status: 500 }
      );
    }

    // Queue welcome email
    const emailContent = await generateWelcomeEmail({
      email: subscriber.email,
      preferences: subscriber.preferences,
    });

    await queueEmail({
      toEmail: subscriber.email,
      subject: emailContent.subject,
      htmlBody: emailContent.html,
      textBody: emailContent.text,
      category: 'welcome',
      priority: 3,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription confirmed successfully',
    });
  } catch (error) {
    console.error('[Newsletter Confirm] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * GET /api/newsletter/confirm/:token
 *
 * Get subscription status before confirming
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });
    }

    const subscriber = await getSubscriberByConfirmationToken(token);

    if (!subscriber) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      email: subscriber.email,
      confirmed: subscriber.confirmed,
      preferences: subscriber.preferences,
    });
  } catch (error) {
    console.error('[Newsletter Confirm GET] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
