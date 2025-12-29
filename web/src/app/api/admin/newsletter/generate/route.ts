import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getDb, getEnv } from '@/lib/d1';
import {
  createNewsletterEdition,
  createNewsletterSend,
  getActiveSubscribers,
  queueEmail,
  updateNewsletterEditionContent,
} from '@/lib/db/newsletter-queries';
import { generateNewsletterEmail } from '@/lib/email/templates';
import { generateWeeklyNewsletter } from '@/lib/newsletter/generator';
import { compareSecrets } from '@/lib/security/timing';
/**
 * POST /api/admin/newsletter/generate
 *
 * Generate and queue a weekly newsletter
 *
 * Requires admin authentication via X-Admin-Key header
 *
 * Request body:
 * {
 *   "send": true,  // whether to actually send or just create draft
 *   "language": "en",  // optional
 *   "daysBack": 7  // optional
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
    const { send = false, language = 'en', daysBack = 7 } = body;

    // Generate newsletter content
    const newsletter = await generateWeeklyNewsletter({
      language,
      daysBack,
    });

    // Create newsletter edition
    const edition = await createNewsletterEdition({
      title: newsletter.title,
      subject: newsletter.subject,
      articleIds: newsletter.articleIds,
      categories: newsletter.categories,
      language,
    });

    // Update with content
    await updateNewsletterEditionContent(edition.id, {
      html: newsletter.contentHtml,
      text: newsletter.contentText,
      previewText: newsletter.previewText,
    });

    if (!send) {
      return NextResponse.json({
        success: true,
        message: 'Newsletter draft created',
        editionId: edition.id,
        articleCount: newsletter.articleCount,
      });
    }

    // Get active subscribers
    const subscribers = await getActiveSubscribers({
      categories: newsletter.categories,
      language,
      limit: 10000,
    });

    let queuedCount = 0;

    // Queue emails for all subscribers
    for (const subscriber of subscribers) {
      // Create send record
      await createNewsletterSend({
        editionId: edition.id,
        subscriberId: subscriber.id,
      });

      // Generate personalized email
      const emailContent = await generateNewsletterEmail({
        subscriberEmail: subscriber.email,
        unsubscribeToken: subscriber.unsubscribeToken || '',
        title: newsletter.title,
        previewText: newsletter.previewText,
        contentHtml: newsletter.contentHtml,
      });

      // Queue email
      await queueEmail({
        toEmail: subscriber.email,
        subject: emailContent.subject,
        htmlBody: emailContent.html,
        textBody: emailContent.text,
        category: 'newsletter',
        priority: 5,
      });

      queuedCount++;
    }

    // Update edition with recipient count
    const db = await getDb();
    await db
      .prepare('UPDATE newsletter_editions SET recipient_count = ? WHERE id = ?')
      .bind(queuedCount, edition.id)
      .run();

    return NextResponse.json({
      success: true,
      message: `Newsletter generated and queued for ${queuedCount} subscribers`,
      editionId: edition.id,
      recipientCount: queuedCount,
      articleCount: newsletter.articleCount,
    });
  } catch (error) {
    console.error('[Newsletter Generate] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * GET /api/admin/newsletter/generate
 *
 * Preview newsletter content without sending
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
    const language = (searchParams.get('language') || 'en') as 'en' | 'zh';
    const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);

    // Generate newsletter content
    const newsletter = await generateWeeklyNewsletter({
      language,
      daysBack,
    });

    return NextResponse.json({
      success: true,
      newsletter: {
        title: newsletter.title,
        subject: newsletter.subject,
        previewText: newsletter.previewText,
        contentHtml: newsletter.contentHtml,
        articleCount: newsletter.articleCount,
        categories: newsletter.categories,
        articleIds: newsletter.articleIds,
      },
    });
  } catch (error) {
    console.error('[Newsletter Generate GET] Error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
