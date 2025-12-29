/**
 * Email templates for newsletter subscription system
 */

import { getSiteUrl } from '@/lib/d1';

export interface ConfirmationEmailData {
  email: string;
  confirmationToken: string;
}

export interface WelcomeEmailData {
  email: string;
  preferences?: {
    categories: string[];
    frequency: string;
    language: string;
  };
}

export interface NewsletterData {
  subscriberEmail: string;
  unsubscribeToken: string;
  title: string;
  previewText?: string;
  contentHtml: string;
  articleCount?: number;
}

export interface UnsubscribeConfirmationData {
  email: string;
}

// ============================================================================
// CONFIRMATION EMAIL
// ============================================================================

/**
 * Generate confirmation email
 */
export async function generateConfirmationEmail(
  data: ConfirmationEmailData
): Promise<{ subject: string; html: string; text: string }> {
  const siteUrl = await getSiteUrl();
  const confirmUrl = `${siteUrl}/newsletter/confirm/${data.confirmationToken}`;

  return {
    subject: 'Confirm your BestBlogs.dev newsletter subscription',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your subscription</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #e5e5e5; }
    .logo { font-size: 24px; font-weight: bold; color: #000; }
    .content { padding: 30px 0; }
    .button { display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .button:hover { background: #333; }
    .footer { padding: 20px 0; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">BestBlogs.dev</div>
    </div>
    <div class="content">
      <h1>Confirm your subscription</h1>
      <p>Thanks for signing up for the BestBlogs.dev newsletter! We're excited to keep you updated with the latest AI news and insights.</p>
      <p>Please confirm your email address by clicking the button below:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" class="button">Confirm Subscription</a>
      </p>
      <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; color: #999; word-break: break-all;">${confirmUrl}</p>
      <p style="font-size: 14px; margin-top: 30px;">This link will expire in 7 days. If you didn't request this subscription, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>BestBlogs.dev - Curated AI news and insights</p>
      <p>You received this email because a subscription was requested using this address.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Confirm your BestBlogs.dev subscription

Thanks for signing up for the BestBlogs.dev newsletter!

Please confirm your email address by visiting this link:
${confirmUrl}

This link will expire in 7 days. If you didn't request this subscription, you can safely ignore this email.

---
BestBlogs.dev - Curated AI news and insights
    `.trim(),
  };
}

// ============================================================================
// WELCOME EMAIL
// ============================================================================

/**
 * Generate welcome email (after confirmation)
 */
export async function generateWelcomeEmail(
  data: WelcomeEmailData
): Promise<{ subject: string; html: string; text: string }> {
  const siteUrl = await getSiteUrl();

  const categories = data.preferences?.categories?.join(', ') || 'all categories';
  const frequency = data.preferences?.frequency || 'weekly';

  return {
    subject: 'Welcome to BestBlogs.dev!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BestBlogs.dev</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #e5e5e5; }
    .logo { font-size: 24px; font-weight: bold; color: #000; }
    .content { padding: 30px 0; }
    .footer { padding: 20px 0; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">BestBlogs.dev</div>
    </div>
    <div class="content">
      <h1>Welcome to BestBlogs.dev!</h1>
      <p>You're all set! You've successfully subscribed to receive ${frequency} updates on ${categories}.</p>
      <p>BestBlogs.dev brings you the latest AI news, insights, and analysis from top sources across the industry. Our newsletter features:</p>
      <ul>
        <li>Curated AI news and updates</li>
        <li>In-depth analysis and commentary</li>
        <li>Highlights from top AI blogs and publications</li>
        <li>Exclusive insights and research summaries</li>
      </ul>
      <p>Visit <a href="${siteUrl}">${siteUrl}</a> to explore the latest articles and updates.</p>
      <p>If you want to update your preferences or unsubscribe, you can use the link at the bottom of any newsletter email.</p>
      <p>Thanks for joining us!</p>
    </div>
    <div class="footer">
      <p>BestBlogs.dev - Curated AI news and insights</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Welcome to BestBlogs.dev!

You're all set! You've successfully subscribed to receive ${frequency} updates on ${categories}.

BestBlogs.dev brings you the latest AI news, insights, and analysis from top sources across the industry.

Visit ${siteUrl} to explore the latest articles and updates.

If you want to update your preferences or unsubscribe, you can use the link at the bottom of any newsletter email.

Thanks for joining us!

---
BestBlogs.dev - Curated AI news and insights
    `.trim(),
  };
}

// ============================================================================
// NEWSLETTER EMAIL
// ============================================================================

/**
 * Generate newsletter email
 */
export async function generateNewsletterEmail(
  data: NewsletterData
): Promise<{ subject: string; html: string; text: string }> {
  const siteUrl = await getSiteUrl();
  const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe/${data.unsubscribeToken}`;
  const preferencesUrl = `${siteUrl}/newsletter/preferences/${data.unsubscribeToken}`;

  return {
    subject: data.title,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
	    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 0; }
	    .container { max-width: 640px; margin: 0 auto; background: #fff; }
	    .header { background: #000; padding: 30px 20px; text-align: center; }
	    .logo { font-size: 28px; font-weight: bold; color: #fff; text-decoration: none; }
	    .preheader { padding: 15px 20px; background: #f9f9f9; font-size: 14px; color: #666; }
	    .content { padding: 30px 20px; }
	    .article { margin-bottom: 30px; padding-bottom: 30px; border-bottom: 1px solid #e5e5e5; }
	    .article:last-child { border-bottom: none; }
	    .article-title { font-size: 20px; font-weight: 600; margin: 0 0 10px; }
	    .article-title a { color: #000; text-decoration: none; }
	    .article-title a:hover { text-decoration: underline; }
	    .article-summary { color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 10px; }
	    .article-meta { font-size: 13px; color: #888; }
	    .footer { padding: 30px 20px; background: #f9f9f9; text-align: center; font-size: 13px; color: #666; }
	    .footer a { color: #0066cc; text-decoration: none; }
	    .footer a:hover { text-decoration: underline; }
	    .unsubscribe { font-size: 11px; color: #999; margin-top: 15px; }
	    .unsubscribe a { color: #999; }
	    @media only screen and (max-width: 600px) {
	      .container { width: 100% !important; }
	      .header { padding: 24px 16px !important; }
	      .preheader { padding: 12px 16px !important; }
	      .content { padding: 24px 16px !important; }
	      .footer { padding: 24px 16px !important; }
	      .article-title { font-size: 18px !important; }
	    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${siteUrl}" class="logo">BestBlogs.dev</a>
    </div>
    ${data.previewText ? `<div class="preheader">${data.previewText}</div>` : ''}
    <div class="content">
      ${data.contentHtml}
    </div>
    <div class="footer">
      <p>You're receiving this email because you subscribed to BestBlogs.dev.</p>
      <p><a href="${preferencesUrl}">Manage preferences</a> | <a href="${siteUrl}">View online</a></p>
      <div class="unsubscribe">
        <a href="${unsubscribeUrl}">Unsubscribe</a> from this newsletter.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
${data.title}
${'='.repeat(data.title.length)}

${data.contentHtml
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .trim()}

---
You're receiving this email because you subscribed to BestBlogs.dev.
Manage preferences: ${preferencesUrl}
Unsubscribe: ${unsubscribeUrl}

BestBlogs.dev - Curated AI news and insights
${siteUrl}
    `.trim(),
  };
}

// ============================================================================
// UNSUBSCRIBE CONFIRMATION EMAIL
// ============================================================================

/**
 * Generate unsubscribe confirmation email
 */
export async function generateUnsubscribeConfirmationEmail(
  _data: UnsubscribeConfirmationData
): Promise<{ subject: string; html: string; text: string }> {
  const siteUrl = await getSiteUrl();

  return {
    subject: "You've been unsubscribed from BestBlogs.dev",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #e5e5e5; }
    .logo { font-size: 24px; font-weight: bold; color: #000; }
    .content { padding: 30px 0; }
    .footer { padding: 20px 0; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">BestBlogs.dev</div>
    </div>
    <div class="content">
      <h1>You've been unsubscribed</h1>
      <p>You've been successfully unsubscribed from BestBlogs.dev newsletters.</p>
      <p>We're sorry to see you go! If you change your mind, you can always resubscribe by visiting <a href="${siteUrl}/newsletter">${siteUrl}/newsletter</a>.</p>
      <p>We'd love to hear why you unsubscribed. If you have a moment, please let us know how we can improve.</p>
      <p>Thanks for being part of our community!</p>
    </div>
    <div class="footer">
      <p>BestBlogs.dev - Curated AI news and insights</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
You've been unsubscribed from BestBlogs.dev

You've been successfully unsubscribed from BestBlogs.dev newsletters.

We're sorry to see you go! If you change your mind, you can always resubscribe by visiting ${siteUrl}/newsletter

We'd love to hear why you unsubscribed. If you have a moment, please let us know how we can improve.

Thanks for being part of our community!

---
BestBlogs.dev - Curated AI news and insights
    `.trim(),
  };
}

// ============================================================================
// PLAIN TEXT CONVERTER
// ============================================================================

/**
 * Convert HTML to plain text (basic implementation)
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
