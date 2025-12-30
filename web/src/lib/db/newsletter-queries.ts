import { nanoid } from 'nanoid';

import { getDb } from '@/lib/d1';

import type {
  Subscriber,
  SubscriberInput,
  SubscriberUpdateInput,
  SubscriberPreferences,
  NewsletterEdition,
  NewsletterEditionInput,
  NewsletterSend,
  NewsletterClick,
  NewsletterStats,
  SubscriberStats,
  QueuedEmail,
  EmailQueueInput,
  NewsletterStatus,
  NewsletterCategory,
  NewsletterLanguage,
} from './newsletter-types';

// Default preferences for new subscribers
const DEFAULT_PREFERENCES: SubscriberPreferences = {
  categories: [
    'Artificial_Intelligence',
    'Business_Tech',
    'Programming_Technology',
    'Product_Development',
  ],
  frequency: 'weekly',
  language: 'en',
};

// Helper to parse preferences from JSON
function parsePreferences(json: string | null): SubscriberPreferences {
  if (!json) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const parsed = JSON.parse(json);
    return {
      categories: parsed.categories || DEFAULT_PREFERENCES.categories,
      frequency: parsed.frequency || DEFAULT_PREFERENCES.frequency,
      language: parsed.language || DEFAULT_PREFERENCES.language,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

// Helper to stringify preferences
function stringifyPreferences(prefs: Partial<SubscriberPreferences>): string {
  const merged = {
    ...DEFAULT_PREFERENCES,
    ...prefs,
  };
  return JSON.stringify(merged);
}

// ============================================================================
// SUBSCRIBER QUERIES
// ============================================================================

/**
 * Get a subscriber by email address
 */
export async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1')
    .bind(email.toLowerCase())
    .first();

  if (!row) {
    return null;
  }

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email),
    confirmed: Number(r.confirmed) === 1,
    confirmationToken: r.confirmation_token as string | null,
    unsubscribeToken: r.unsubscribe_token as string | null,
    preferences: parsePreferences(r.preferences as string | null),
    subscribedAt: Number(r.subscribed_at),
    confirmedAt: numberOrNull(r.confirmed_at),
    unsubscribedAt: numberOrNull(r.unsubscribed_at),
    lastSentAt: numberOrNull(r.last_sent_at),
    sendCount: Number(r.send_count || 0),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Get a subscriber by ID
 */
export async function getSubscriberById(id: string): Promise<Subscriber | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM newsletter_subscribers WHERE id = ? LIMIT 1')
    .bind(id)
    .first();

  if (!row) {
    return null;
  }

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email),
    confirmed: Number(r.confirmed) === 1,
    confirmationToken: r.confirmation_token as string | null,
    unsubscribeToken: r.unsubscribe_token as string | null,
    preferences: parsePreferences(r.preferences as string | null),
    subscribedAt: Number(r.subscribed_at),
    confirmedAt: numberOrNull(r.confirmed_at),
    unsubscribedAt: numberOrNull(r.unsubscribed_at),
    lastSentAt: numberOrNull(r.last_sent_at),
    sendCount: Number(r.send_count || 0),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Get a subscriber by confirmation token
 */
export async function getSubscriberByConfirmationToken(token: string): Promise<Subscriber | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM newsletter_subscribers WHERE confirmation_token = ? LIMIT 1')
    .bind(token)
    .first();

  if (!row) {
    return null;
  }

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email),
    confirmed: Number(r.confirmed) === 1,
    confirmationToken: r.confirmation_token as string | null,
    unsubscribeToken: r.unsubscribe_token as string | null,
    preferences: parsePreferences(r.preferences as string | null),
    subscribedAt: Number(r.subscribed_at),
    confirmedAt: numberOrNull(r.confirmed_at),
    unsubscribedAt: numberOrNull(r.unsubscribed_at),
    lastSentAt: numberOrNull(r.last_sent_at),
    sendCount: Number(r.send_count || 0),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Get a subscriber by unsubscribe token
 */
export async function getSubscriberByUnsubscribeToken(token: string): Promise<Subscriber | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ? LIMIT 1')
    .bind(token)
    .first();

  if (!row) {
    return null;
  }

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email),
    confirmed: Number(r.confirmed) === 1,
    confirmationToken: r.confirmation_token as string | null,
    unsubscribeToken: r.unsubscribe_token as string | null,
    preferences: parsePreferences(r.preferences as string | null),
    subscribedAt: Number(r.subscribed_at),
    confirmedAt: numberOrNull(r.confirmed_at),
    unsubscribedAt: numberOrNull(r.unsubscribed_at),
    lastSentAt: numberOrNull(r.last_sent_at),
    sendCount: Number(r.send_count || 0),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Create a new subscriber
 */
export async function createSubscriber(input: SubscriberInput): Promise<Subscriber> {
  const db = await getDb();
  const id = nanoid();
  const confirmationToken = nanoid(32);
  const unsubscribeToken = nanoid(32);
  const now = Date.now();
  const preferences = stringifyPreferences(input.preferences || {});

  const result = await db
    .prepare(
      `INSERT INTO newsletter_subscribers (
        id, email, confirmed, confirmation_token, unsubscribe_token,
        preferences, subscribed_at, created_at, updated_at
      ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.email.toLowerCase(),
      confirmationToken,
      unsubscribeToken,
      preferences,
      now,
      now,
      now
    )
    .run();

  if (!result.success) {
    throw new Error('Failed to create subscriber');
  }

  return {
    id,
    email: input.email.toLowerCase(),
    confirmed: false,
    confirmationToken,
    unsubscribeToken,
    preferences: parsePreferences(preferences),
    subscribedAt: now,
    confirmedAt: null,
    unsubscribedAt: null,
    lastSentAt: null,
    sendCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Confirm a subscriber's email
 */
export async function confirmSubscriber(token: string): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const result = await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET confirmed = 1, confirmed_at = ?, confirmation_token = NULL, updated_at = ?
       WHERE confirmation_token = ? AND confirmed = 0`
    )
    .bind(now, now, token)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Unsubscribe a subscriber
 */
export async function unsubscribeSubscriber(token: string): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const result = await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET unsubscribed_at = ?, unsubscribe_token = NULL, updated_at = ?
       WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL`
    )
    .bind(now, now, token)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Update subscriber preferences
 */
export async function updateSubscriberPreferences(
  id: string,
  input: SubscriberUpdateInput
): Promise<Subscriber | null> {
  const db = await getDb();
  const now = Date.now();

  // Get current preferences
  const current = await getSubscriberById(id);
  if (!current) {
    return null;
  }

  const mergedPreferences = {
    ...current.preferences,
    ...input.preferences,
  };

  const preferencesJson = stringifyPreferences(mergedPreferences);

  await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET preferences = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(preferencesJson, now, id)
    .run();

  return getSubscriberById(id);
}

/**
 * Delete a subscriber (admin function)
 */
export async function deleteSubscriber(id: string): Promise<boolean> {
  const db = await getDb();

  const result = await db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').bind(id).run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Re-subscribe a previously unsubscribed user
 */
export async function resubscriber(email: string): Promise<Subscriber | null> {
  const db = await getDb();
  const now = Date.now();
  const confirmationToken = nanoid(32);

  const result = await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET confirmed = 0, confirmation_token = ?, unsubscribed_at = NULL,
           subscribed_at = ?, updated_at = ?
       WHERE email = ? AND unsubscribed_at IS NOT NULL`
    )
    .bind(confirmationToken, now, now, email.toLowerCase())
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return null;
  }

  return getSubscriberByEmail(email);
}

/**
 * List subscribers with pagination and filters
 */
export async function listSubscribers(
  input: {
    limit?: number;
    offset?: number;
    confirmed?: boolean;
    status?: 'all' | 'active' | 'unsubscribed';
  } = {}
): Promise<{ items: Subscriber[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const where: string[] = [];
  const binds: unknown[] = [];

  if (input.confirmed !== undefined) {
    where.push('confirmed = ?');
    binds.push(input.confirmed ? 1 : 0);
  }

  if (input.status === 'active') {
    where.push('confirmed = 1 AND unsubscribed_at IS NULL');
  } else if (input.status === 'unsubscribed') {
    where.push('unsubscribed_at IS NOT NULL');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM newsletter_subscribers ${whereClause}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  // Get paginated results
  const rows = await db
    .prepare(
      `SELECT * FROM newsletter_subscribers ${whereClause}
       ORDER BY subscribed_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = (rows.results ?? []) as Record<string, unknown>[];
  return {
    items: items.map((r) => ({
      id: String(r.id),
      email: String(r.email),
      confirmed: Number(r.confirmed) === 1,
      confirmationToken: r.confirmation_token as string | null,
      unsubscribeToken: r.unsubscribe_token as string | null,
      preferences: parsePreferences(r.preferences as string | null),
      subscribedAt: Number(r.subscribed_at),
      confirmedAt: numberOrNull(r.confirmed_at),
      unsubscribedAt: numberOrNull(r.unsubscribed_at),
      lastSentAt: numberOrNull(r.last_sent_at),
      sendCount: Number(r.send_count || 0),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    })),
    total,
  };
}

/**
 * Increment subscriber send count
 */
export async function incrementSubscriberSendCount(id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET send_count = send_count + 1, last_sent_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(now, now, id)
    .run();
}

// ============================================================================
// NEWSLETTER EDITION QUERIES
// ============================================================================

/**
 * Get a newsletter edition by ID
 */
export async function getNewsletterEdition(id: string): Promise<NewsletterEdition | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM newsletter_editions WHERE id = ? LIMIT 1')
    .bind(id)
    .first();

  if (!row) {
    return null;
  }

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    title: String(r.title),
    subject: String(r.subject),
    previewText: r.preview_text as string | null,
    contentHtml: String(r.content_html),
    contentText: String(r.content_text),
    articleIds: r.article_ids ? JSON.parse(r.article_ids as string) : [],
    categories: r.categories ? JSON.parse(r.categories as string) : [],
    language: String(r.language || 'en') as NewsletterLanguage,
    recipientCount: Number(r.recipient_count || 0),
    sentCount: Number(r.sent_count || 0),
    openCount: Number(r.open_count || 0),
    clickCount: Number(r.click_count || 0),
    status: String(r.status) as NewsletterStatus,
    scheduledFor: numberOrNull(r.scheduled_for),
    sentAt: numberOrNull(r.sent_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Create a newsletter edition
 */
export async function createNewsletterEdition(
  input: NewsletterEditionInput
): Promise<NewsletterEdition> {
  const db = await getDb();
  const id = nanoid();
  const now = Date.now();
  const language = input.language || 'en';

  // Generate subject if not provided
  const subject = input.subject || input.title;

  const result = await db
    .prepare(
      `INSERT INTO newsletter_editions (
        id, title, subject, article_ids, categories, language,
        content_html, content_text, status, scheduled_for, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.title,
      subject,
      JSON.stringify(input.articleIds),
      JSON.stringify(input.categories || []),
      language,
      'draft',
      input.scheduledFor ?? null,
      now,
      now
    )
    .run();

  if (!result.success) {
    throw new Error('Failed to create newsletter edition');
  }

  return getNewsletterEdition(id) as Promise<NewsletterEdition>;
}

/**
 * Update newsletter edition content
 */
export async function updateNewsletterEditionContent(
  id: string,
  content: { html: string; text: string; previewText?: string }
): Promise<NewsletterEdition | null> {
  const db = await getDb();
  const now = Date.now();

  await db
    .prepare(
      `UPDATE newsletter_editions
       SET content_html = ?, content_text = ?, preview_text = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(content.html, content.text, content.previewText ?? null, now, id)
    .run();

  return getNewsletterEdition(id);
}

/**
 * Update newsletter edition status
 */
export async function updateNewsletterEditionStatus(
  id: string,
  status: NewsletterStatus
): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const binds: unknown[] = [status, now, id];

  if (status === 'sent') {
    updates.push('sent_at = ?');
    binds.unshift(now);
  }

  const result = await db
    .prepare(`UPDATE newsletter_editions SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * List newsletter editions
 */
export async function listNewsletterEditions(
  input: {
    limit?: number;
    offset?: number;
    status?: NewsletterStatus;
    language?: NewsletterLanguage;
  } = {}
): Promise<{ items: NewsletterEdition[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 20, 100);
  const offset = input.offset ?? 0;

  const where: string[] = [];
  const binds: unknown[] = [];

  if (input.status) {
    where.push('status = ?');
    binds.push(input.status);
  }

  if (input.language) {
    where.push('language = ?');
    binds.push(input.language);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM newsletter_editions ${whereClause}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  // Get paginated results
  const rows = await db
    .prepare(
      `SELECT * FROM newsletter_editions ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = (rows.results ?? []) as Record<string, unknown>[];
  return {
    items: items.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      subject: String(r.subject),
      previewText: r.preview_text as string | null,
      contentHtml: String(r.content_html),
      contentText: String(r.content_text),
      articleIds: r.article_ids ? JSON.parse(r.article_ids as string) : [],
      categories: r.categories ? JSON.parse(r.categories as string) : [],
      language: String(r.language || 'en') as NewsletterLanguage,
      recipientCount: Number(r.recipient_count || 0),
      sentCount: Number(r.sent_count || 0),
      openCount: Number(r.open_count || 0),
      clickCount: Number(r.click_count || 0),
      status: String(r.status) as NewsletterStatus,
      scheduledFor: numberOrNull(r.scheduled_for),
      sentAt: numberOrNull(r.sent_at),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    })),
    total,
  };
}

/**
 * Delete a newsletter edition
 */
export async function deleteNewsletterEdition(id: string): Promise<boolean> {
  const db = await getDb();

  const result = await db.prepare('DELETE FROM newsletter_editions WHERE id = ?').bind(id).run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Increment newsletter stats
 */
export async function incrementNewsletterStats(
  id: string,
  field: 'open_count' | 'click_count' | 'sent_count'
): Promise<void> {
  const db = await getDb();

  await db
    .prepare(`UPDATE newsletter_editions SET ${field} = ${field} + 1 WHERE id = ?`)
    .bind(id)
    .run();
}

// ============================================================================
// NEWSLETTER SEND QUERIES
// ============================================================================

/**
 * Create a newsletter send record
 */
export async function createNewsletterSend(input: {
  editionId: string;
  subscriberId: string;
}): Promise<NewsletterSend> {
  const db = await getDb();
  const id = nanoid();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO newsletter_sends (id, edition_id, subscriber_id, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    )
    .bind(id, input.editionId, input.subscriberId, now)
    .run();

  return {
    id,
    editionId: input.editionId,
    subscriberId: input.subscriberId,
    status: 'pending',
    sentAt: null,
    openedAt: null,
    clickCount: 0,
    errorMessage: null,
    createdAt: now,
  };
}

/**
 * Update send status
 */
export async function updateSendStatus(
  id: string,
  status: 'sent' | 'failed' | 'bounced',
  errorMessage?: string
): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const result = await db
    .prepare(
      `UPDATE newsletter_sends
       SET status = ?, sent_at = ?, error_message = ?
       WHERE id = ?`
    )
    .bind(status, status === 'sent' ? now : null, errorMessage ?? null, id)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Record email open
 */
export async function recordEmailOpen(sendId: string): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const result = await db
    .prepare(
      `UPDATE newsletter_sends
       SET opened_at = ?, click_count = click_count + 1
       WHERE id = ? AND opened_at IS NULL`
    )
    .bind(now, sendId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Record link click
 */
export async function recordLinkClick(input: {
  sendId: string;
  url: string;
  articleId?: string;
}): Promise<NewsletterClick> {
  const db = await getDb();
  const id = nanoid();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO newsletter_clicks (id, send_id, url, article_id, clicked_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, input.sendId, input.url, input.articleId ?? null, now)
    .run();

  // Increment click counts
  await db
    .prepare(`UPDATE newsletter_sends SET click_count = click_count + 1 WHERE id = ?`)
    .bind(input.sendId)
    .run();

  const send = await db
    .prepare('SELECT edition_id FROM newsletter_sends WHERE id = ?')
    .bind(input.sendId)
    .first();

  if (send) {
    await db
      .prepare(`UPDATE newsletter_editions SET click_count = click_count + 1 WHERE id = ?`)
      .bind((send as { edition_id: string }).edition_id)
      .run();
  }

  return {
    id,
    sendId: input.sendId,
    url: input.url,
    articleId: input.articleId ?? null,
    clickedAt: now,
  };
}

/**
 * Get sends for a subscriber
 */
export async function getSubscriberSends(subscriberId: string): Promise<NewsletterSend[]> {
  const db = await getDb();

  const rows = await db
    .prepare(`SELECT * FROM newsletter_sends WHERE subscriber_id = ? ORDER BY created_at DESC`)
    .bind(subscriberId)
    .all();

  const items = (rows.results ?? []) as Record<string, unknown>[];
  return items.map((r) => ({
    id: String(r.id),
    editionId: String(r.edition_id),
    subscriberId: String(r.subscriber_id),
    status: String(r.status) as 'pending' | 'sent' | 'failed' | 'bounced',
    sentAt: numberOrNull(r.sent_at),
    openedAt: numberOrNull(r.opened_at),
    clickCount: Number(r.click_count || 0),
    errorMessage: r.error_message as string | null,
    createdAt: Number(r.created_at),
  }));
}

// ============================================================================
// EMAIL QUEUE QUERIES
// ============================================================================

/**
 * Queue an email for sending
 */
export async function queueEmail(input: EmailQueueInput): Promise<QueuedEmail> {
  const db = await getDb();
  const id = nanoid();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO email_queue (
        id, to_email, subject, html_body, text_body, from_email, from_name,
        category, priority, scheduled_for, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.toEmail,
      input.subject,
      input.htmlBody,
      input.textBody,
      input.fromEmail || 'noreply@bestblogs.dev',
      input.fromName || 'BestBlogs.dev',
      input.category ?? null,
      input.priority ?? 5,
      input.scheduledFor ?? now,
      now,
      now
    )
    .run();

  return {
    id,
    toEmail: input.toEmail,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody: input.textBody,
    fromEmail: input.fromEmail || 'noreply@bestblogs.dev',
    fromName: input.fromName || 'BestBlogs.dev',
    category: input.category ?? null,
    priority: input.priority ?? 5,
    attempts: 0,
    maxAttempts: 3,
    status: 'pending',
    errorMessage: null,
    scheduledFor: input.scheduledFor ?? now,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get pending emails from queue
 */
export async function getPendingEmails(limit: number = 10): Promise<QueuedEmail[]> {
  const db = await getDb();
  const now = Date.now();

  const rows = await db
    .prepare(
      `SELECT * FROM email_queue
       WHERE status = 'pending' AND scheduled_for <= ?
       ORDER BY priority ASC, scheduled_for ASC
       LIMIT ?`
    )
    .bind(now, limit)
    .all();

  const items = (rows.results ?? []) as Record<string, unknown>[];
  return items.map((r) => ({
    id: String(r.id),
    toEmail: String(r.to_email),
    subject: String(r.subject),
    htmlBody: String(r.html_body),
    textBody: String(r.text_body),
    fromEmail: String(r.from_email),
    fromName: String(r.from_name),
    category: r.category as string | null,
    priority: Number(r.priority),
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
    status: String(r.status) as 'pending' | 'processing' | 'sent' | 'failed',
    errorMessage: r.error_message as string | null,
    scheduledFor: Number(r.scheduled_for),
    sentAt: numberOrNull(r.sent_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }));
}

/**
 * Update email queue status
 */
export async function updateEmailStatus(
  id: string,
  status: 'processing' | 'sent' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const binds: unknown[] = [status, now];

  if (status === 'processing') {
    updates.push('attempts = attempts + 1');
  } else if (status === 'sent') {
    updates.push('sent_at = ?');
    binds.push(now);
  }

  if (errorMessage) {
    updates.push('error_message = ?');
    binds.push(errorMessage);
  }

  binds.push(id);

  const result = await db
    .prepare(`UPDATE email_queue SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Delete sent emails (cleanup)
 */
export async function deleteSentEmails(olderThan: number): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - olderThan;

  const result = await db
    .prepare(`DELETE FROM email_queue WHERE status = 'sent' AND sent_at < ?`)
    .bind(cutoff)
    .run();

  return result.meta?.changes ?? 0;
}

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Get overall newsletter statistics
 */
export async function getNewsletterStats(): Promise<NewsletterStats> {
  const db = await getDb();

  const [subscribers, editions, sends] = await Promise.all([
    db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN confirmed = 1 THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN confirmed = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM newsletter_subscribers
    `
      )
      .first(),

    db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
      FROM newsletter_editions
    `
      )
      .first(),

    db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(click_count) as clicks
      FROM newsletter_sends WHERE status = 'sent'
    `
      )
      .first(),
  ]);

  const sub = subscribers as Record<string, unknown>;
  const ed = editions as Record<string, unknown>;
  const sd = sends as Record<string, unknown>;

  const totalSent = Number(sd.total ?? 0);
  const totalOpens = Number(sd.opened ?? 0);
  const totalClicks = Number(sd.clicks ?? 0);

  return {
    totalSubscribers: Number(sub.total ?? 0),
    confirmedSubscribers: Number(sub.confirmed ?? 0),
    pendingSubscribers: Number(sub.pending ?? 0),
    unsubscribedSubscribers: Number(sub.unsubscribed ?? 0),
    totalEditions: Number(ed.total ?? 0),
    sentEditions: Number(ed.sent ?? 0),
    totalEmailsSent: totalSent,
    totalOpens: totalOpens,
    totalClicks: totalClicks,
    averageOpenRate: totalSent > 0 ? totalOpens / totalSent : 0,
    averageClickRate: totalOpens > 0 ? totalClicks / totalOpens : 0,
  };
}

/**
 * Get subscriber statistics
 */
export async function getSubscriberStats(subscriberId: string): Promise<SubscriberStats> {
  const db = await getDb();

  const row = await db
    .prepare(
      `
      SELECT
        COUNT(*) as emails_received,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as emails_opened,
        SUM(click_count) as clicks_tracked,
        MAX(sent_at) as last_email_at,
        MAX(opened_at) as last_open_at
      FROM newsletter_sends
      WHERE subscriber_id = ? AND status = 'sent'
    `
    )
    .bind(subscriberId)
    .first();

  const r = row as Record<string, unknown>;

  return {
    subscriberId,
    emailsReceived: Number(r.emails_received ?? 0),
    emailsOpened: Number(r.emails_opened ?? 0),
    clicksTracked: Number(r.clicks_tracked ?? 0),
    lastEmailAt: numberOrNull(r.last_email_at),
    lastOpenAt: numberOrNull(r.last_open_at),
  };
}

/**
 * Get active subscribers matching criteria (for newsletter sending)
 */
export async function getActiveSubscribers(
  input: {
    categories?: NewsletterCategory[];
    language?: NewsletterLanguage;
    limit?: number;
  } = {}
): Promise<Subscriber[]> {
  const db = await getDb();
  const limit = input.limit ?? 1000;

  const where: string[] = ['confirmed = 1', 'unsubscribed_at IS NULL'];
  const binds: unknown[] = [];

  if (input.language) {
    where.push('preferences LIKE ?');
    binds.push(`%"language":"${input.language}"%`);
  }

  const whereClause = where.join(' AND ');

  const rows = await db
    .prepare(
      `SELECT * FROM newsletter_subscribers WHERE ${whereClause} ORDER BY subscribed_at DESC LIMIT ?`
    )
    .bind(...binds, limit)
    .all();

  const items = (rows.results ?? []) as Record<string, unknown>[];

  // Filter by categories if specified
  let filtered = items;
  if (input.categories && input.categories.length > 0) {
    filtered = items.filter((r) => {
      const prefs = parsePreferences(r.preferences as string | null);
      return prefs.categories.some((c) => input.categories!.includes(c));
    });
  }

  return filtered.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    confirmed: Number(r.confirmed) === 1,
    confirmationToken: r.confirmation_token as string | null,
    unsubscribeToken: r.unsubscribe_token as string | null,
    preferences: parsePreferences(r.preferences as string | null),
    subscribedAt: Number(r.subscribed_at),
    confirmedAt: numberOrNull(r.confirmed_at),
    unsubscribedAt: numberOrNull(r.unsubscribed_at),
    lastSentAt: numberOrNull(r.last_sent_at),
    sendCount: Number(r.send_count || 0),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }));
}
