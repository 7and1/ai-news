import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSubscriber, getSubscriberByEmail, queueEmail } from '@/lib/db/newsletter-queries';
import type { NewsletterCategory, Frequency, NewsletterLanguage } from '@/lib/db/newsletter-types';
import { isValidEmail, sanitizeEmail } from '@/lib/email/resend';
import { generateConfirmationEmail } from '@/lib/email/templates';

const subscribeSchema = z.object({
  email: z.string().email(),
  preferences: z
    .object({
      categories: z.array(z.string()).optional(),
      frequency: z.enum(['daily', 'weekly', 'biweekly'] as const).optional(),
      language: z.enum(['en', 'zh'] as const).optional(),
    })
    .optional(),
});

/**
 * POST /api/newsletter/subscribe
 *
 * Subscribe a new email to the newsletter
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "preferences": {
 *     "categories": ["Artificial_Intelligence"],
 *     "frequency": "weekly",
 *     "language": "en"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = subscribeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    const email = sanitizeEmail(result.data.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    // Check if subscriber already exists
    const existing = await getSubscriberByEmail(email);

    if (existing) {
      if (existing.confirmed) {
        // Already confirmed
        return NextResponse.json({
          success: true,
          message: 'Already subscribed',
          confirmed: true,
        });
      } else {
        // Pending confirmation, resend token
        const emailContent = await generateConfirmationEmail({
          email,
          confirmationToken: existing.confirmationToken || '',
        });

        await queueEmail({
          toEmail: email,
          subject: emailContent.subject,
          htmlBody: emailContent.html,
          textBody: emailContent.text,
          category: 'confirmation',
          priority: 3, // High priority for confirmation emails
        });

        return NextResponse.json({
          success: true,
          message: 'Confirmation email resent',
          confirmed: false,
        });
      }
    }

    // Check if previously unsubscribed
    // If so, re-subscribe with new confirmation
    // (This is handled in the subscribe logic flow)

    // Create new subscriber
    const subscriber = await createSubscriber({
      email,
      preferences: result.data.preferences as
        | {
            categories?: NewsletterCategory[];
            frequency?: Frequency;
            language?: NewsletterLanguage;
          }
        | undefined,
    });

    // Queue confirmation email
    const emailContent = await generateConfirmationEmail({
      email,
      confirmationToken: subscriber.confirmationToken || '',
    });

    await queueEmail({
      toEmail: email,
      subject: emailContent.subject,
      htmlBody: emailContent.html,
      textBody: emailContent.text,
      category: 'confirmation',
      priority: 3, // High priority for confirmation emails
    });

    return NextResponse.json({
      success: true,
      message: 'Please check your email to confirm your subscription',
      confirmed: false,
    });
  } catch (error) {
    console.error('[Newsletter Subscribe] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while processing your subscription',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/newsletter/subscribe
 *
 * Check if an email is already subscribed
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const sanitized = sanitizeEmail(email);

    if (!isValidEmail(sanitized)) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    const subscriber = await getSubscriberByEmail(sanitized);

    if (!subscriber) {
      return NextResponse.json({
        success: true,
        subscribed: false,
      });
    }

    return NextResponse.json({
      success: true,
      subscribed: true,
      confirmed: subscriber.confirmed,
      unsubscribed: subscriber.unsubscribedAt !== null,
    });
  } catch (error) {
    console.error('[Newsletter Subscribe GET] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
