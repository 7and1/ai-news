import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getEnv } from '@/lib/d1';
import { queueEmail } from '@/lib/db/newsletter-queries';
import { generateNewsletterEmail } from '@/lib/email/templates';
import { compareSecrets } from '@/lib/security/timing';
const testEmailSchema = z.object({
  email: z.string().email(),
  title: z.string(),
  content: z.string(),
});


/**
 * POST /api/admin/newsletter/test
 *
 * Send a test newsletter email
 *
 * Requires admin authentication via X-Admin-Key header
 *
 * Request body:
 * {
 *   "email": "test@example.com",
 *   "title": "Test Newsletter",
 *   "content": "<p>Test content</p>"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const adminKey = request.headers.get('X-Admin-Key');
    const env = await getEnv();
    const expected = env.ADMIN_SECRET;

    if (!adminKey || !expected || !compareSecrets(expected, adminKey)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = testEmailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { email, title, content } = result.data;

    // Generate test email (using a fake unsubscribe token)
    const emailContent = await generateNewsletterEmail({
      subscriberEmail: email,
      unsubscribeToken: 'test-token',
      title,
      contentHtml: content,
      previewText: 'This is a test newsletter',
    });

    // Queue the email
    await queueEmail({
      toEmail: email,
      subject: emailContent.subject,
      htmlBody: emailContent.html,
      textBody: emailContent.text,
      category: 'newsletter_test',
      priority: 1, // Highest priority for test emails
    });

    return NextResponse.json({
      success: true,
      message: 'Test email queued successfully',
    });
  } catch (error) {
    console.error('[Newsletter Test] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
