import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  unsubscribeSubscriber,
  getSubscriberByUnsubscribeToken,
  queueEmail,
} from '@/lib/db/newsletter-queries';
import { generateUnsubscribeConfirmationEmail } from '@/lib/email/templates';

const unsubscribeSchema = z.object({
  token: z.string().optional(),
  email: z.string().email().optional(),
});


/**
 * POST /api/newsletter/unsubscribe
 *
 * Unsubscribe from the newsletter
 *
 * Request body:
 * {
 *   "token": "unsubscribe_token" // OR
 *   "email": "user@example.com"
 * }
 *
 * Note: Token is preferred as it doesn't require email verification
 * Email-based unsubscribe will send a confirmation email first
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = unsubscribeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { token, email } = result.data;

    // If token provided, unsubscribe immediately
    if (token) {
      const subscriber = await getSubscriberByUnsubscribeToken(token);

      if (!subscriber) {
        return NextResponse.json(
          { success: false, error: 'Invalid unsubscribe token' },
          { status: 404 }
        );
      }

      const success = await unsubscribeSubscriber(token);

      if (success) {
        // Queue unsubscribe confirmation email
        const emailContent = await generateUnsubscribeConfirmationEmail({
          email: subscriber.email,
        });

        await queueEmail({
          toEmail: subscriber.email,
          subject: emailContent.subject,
          htmlBody: emailContent.html,
          textBody: emailContent.text,
          category: 'unsubscribe',
          priority: 2,
        });

        return NextResponse.json({
          success: true,
          message: 'Successfully unsubscribed',
        });
      }

      return NextResponse.json({ success: false, error: 'Failed to unsubscribe' }, { status: 500 });
    }

    // If only email provided, we need to verify first
    // For now, return an error - token-based unsubscribe is preferred
    if (email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please use the unsubscribe link from the newsletter email',
          message:
            'For security, please use the unsubscribe link at the bottom of any newsletter email',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: false, error: 'Token or email required' }, { status: 400 });
  } catch (error) {
    console.error('[Newsletter Unsubscribe] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
