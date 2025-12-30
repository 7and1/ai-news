import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { deleteSentEmails, getPendingEmails, updateEmailStatus } from '@/lib/db/newsletter-queries';
import { sendEmail } from '@/lib/email/resend';
import { createMiddleware, ValidationError, withSecurityHeaders } from '@/lib/middleware';
import { logger, reportError } from '@/lib/monitoring';

const bodySchema = z.object({
  limit: z.number().int().min(1).max(200).default(25),
  cleanupDays: z.number().int().min(1).max(365).default(14),
});

export const POST = createMiddleware(
  {
    requireSecret: { key: 'CRON_SECRET' },
    rateLimit: 'ADMIN',
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const startedAt = Date.now();
    const { limit, cleanupDays } = parsed.data;

    try {
      const pending = await getPendingEmails(limit);
      if (pending.length === 0) {
        return NextResponse.json({
          ok: true,
          processed: 0,
          sent: 0,
          failed: 0,
          cleaned: 0,
          durationMs: Date.now() - startedAt,
        });
      }

      await logger.info('Email queue processing started', { count: pending.length });

      let processed = 0;
      let sent = 0;
      let failed = 0;

      for (const email of pending) {
        processed++;

        const locked = await updateEmailStatus(email.id, 'processing');
        if (!locked) {
          continue;
        }

        const result = await sendEmail({
          to: email.toEmail,
          subject: email.subject,
          html: email.htmlBody,
          text: email.textBody,
          from: `${email.fromName} <${email.fromEmail}>`,
        });

        if (result.success) {
          sent++;
          await updateEmailStatus(email.id, 'sent');
        } else {
          failed++;
          await updateEmailStatus(email.id, 'failed', result.error || 'send_failed');
        }
      }

      const cleaned = await deleteSentEmails(cleanupDays * 24 * 60 * 60 * 1000);
      const durationMs = Date.now() - startedAt;

      await logger.info('Email queue processing completed', {
        processed,
        sent,
        failed,
        cleaned,
        durationMs,
      });

      return NextResponse.json({
        ok: true,
        processed,
        sent,
        failed,
        cleaned,
        durationMs,
      });
    } catch (err) {
      await reportError(err, { endpoint: '/api/cron/email/process' });
      throw err;
    }
  }
);

export const OPTIONS = withSecurityHeaders(async (): Promise<NextResponse> => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cron-Secret',
      'Access-Control-Max-Age': '86400',
    },
  });
});
