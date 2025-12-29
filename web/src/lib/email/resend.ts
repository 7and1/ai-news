/**
 * Email Service using Resend API
 * https://resend.com/docs/api-reference/emails/send
 */

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend API
 *
 * Note: This requires RESEND_API_KEY to be set in environment variables
 */
export async function sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
  const env = await getEnv();

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email] RESEND_API_KEY not configured');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const from = options.from || 'BestBlogs.dev <newsletter@bestblogs.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags || [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Resend API error:', response.status, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the environment variables (Cloudflare)
 */
async function getEnv() {
  try {
    // Use the Cloudflare env
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return env as CloudflareEnv;
  } catch {
    // Fallback to process.env for development
    return {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    } as unknown as CloudflareEnv;
  }
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize email address to prevent header injection
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
