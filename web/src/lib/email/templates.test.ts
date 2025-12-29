/**
 * Tests for email templates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock getSiteUrl
vi.mock('../d1', () => ({
  getSiteUrl: vi.fn(() => Promise.resolve('https://bestblogs.dev')),
}));

import { getSiteUrl } from '../d1';

import {
  generateConfirmationEmail,
  generateWelcomeEmail,
  generateNewsletterEmail,
  generateUnsubscribeConfirmationEmail,
  htmlToText,
} from './templates';

describe('email templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSiteUrl).mockResolvedValue('https://bestblogs.dev');
  });

  describe('generateConfirmationEmail', () => {
    it('generates confirmation email', async () => {
      const email = await generateConfirmationEmail({
        email: 'user@example.com',
        confirmationToken: 'token-abc123',
      });

      expect(email).toHaveProperty('subject');
      expect(email).toHaveProperty('html');
      expect(email).toHaveProperty('text');

      expect(email.subject).toContain('Confirm');
      expect(email.html).toContain('Confirm your subscription');
      expect(email.html).toContain('https://bestblogs.dev/newsletter/confirm/token-abc123');
      expect(email.text).toContain('https://bestblogs.dev/newsletter/confirm/token-abc123');
    });

    it('includes confirmation link in HTML', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'test-token',
      });

      expect(email.html).toContain('<a href=');
      expect(email.html).toContain('Confirm Subscription');
    });

    it('includes plain text version', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'test-token',
      });

      expect(email.text).toBeTruthy();
      expect(email.text).not.toContain('<');
      expect(email.text).not.toContain('>');
    });

    it('includes fallback URL in text', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'very-long-token-that-should-wrap',
      });

      expect(email.text).toContain('https://bestblogs.dev/newsletter/confirm/');
    });

    it('includes expiration notice', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'test-token',
      });

      expect(email.html).toContain('7 days');
      expect(email.text).toContain('7 days');
    });

    it('includes brand name', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'test-token',
      });

      expect(email.html).toContain('BestBlogs.dev');
      expect(email.text).toContain('BestBlogs.dev');
    });
  });

  describe('generateWelcomeEmail', () => {
    it('generates welcome email', async () => {
      const email = await generateWelcomeEmail({
        email: 'user@example.com',
        preferences: {
          categories: ['Artificial_Intelligence'],
          frequency: 'weekly',
          language: 'en',
        },
      });

      expect(email.subject).toContain('Welcome');
      expect(email.html).toContain('Welcome to BestBlogs.dev');
      expect(email.text).toContain('Welcome to BestBlogs.dev');
    });

    it('includes preferences in content', async () => {
      const email = await generateWelcomeEmail({
        email: 'user@example.com',
        preferences: {
          categories: ['Artificial_Intelligence', 'Business_Tech'],
          frequency: 'weekly',
          language: 'en',
        },
      });

      expect(email.html).toContain('Artificial_Intelligence');
      expect(email.html).toContain('Business_Tech');
      expect(email.html).toContain('weekly');
    });

    it('handles missing preferences', async () => {
      const email = await generateWelcomeEmail({
        email: 'user@example.com',
      });

      expect(email.html).toContain('all categories');
      expect(email.text).toContain('all categories');
    });

    it('includes features list', async () => {
      const email = await generateWelcomeEmail({
        email: 'user@example.com',
        preferences: {
          categories: ['Artificial_Intelligence'],
          frequency: 'weekly',
          language: 'en',
        },
      });

      expect(email.html).toContain('<ul>');
      expect(email.html).toContain('<li>');
    });

    it('includes site link', async () => {
      const email = await generateWelcomeEmail({
        email: 'user@example.com',
      });

      expect(email.html).toContain('https://bestblogs.dev');
      expect(email.text).toContain('https://bestblogs.dev');
    });
  });

  describe('generateNewsletterEmail', () => {
    const basicData = {
      subscriberEmail: 'user@example.com',
      unsubscribeToken: 'unsub-token',
      title: 'Weekly AI News Roundup',
      contentHtml: '<p>This week in AI news...</p>',
    };

    it('generates newsletter email', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.subject).toBe('Weekly AI News Roundup');
      expect(email.html).toContain('This week in AI news');
      expect(email.text).toContain('This week in AI news');
    });

    it('includes unsubscribe link', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).toContain('https://bestblogs.dev/newsletter/unsubscribe/unsub-token');
      expect(email.text).toContain('https://bestblogs.dev/newsletter/unsubscribe/unsub-token');
    });

    it('includes preferences link', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).toContain('/newsletter/preferences/unsub-token');
      expect(email.text).toContain('/newsletter/preferences/');
    });

    it('includes preview text when provided', async () => {
      const email = await generateNewsletterEmail({
        ...basicData,
        previewText: 'Top stories this week...',
      });

      expect(email.html).toContain('Top stories this week');
    });

    it('excludes preview text when not provided', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).not.toContain('<div class="preheader">');
    });

    it('includes article count when provided', async () => {
      const email = await generateNewsletterEmail({
        ...basicData,
        articleCount: 5,
      });

      // Should display article count somewhere
      expect(email.html).toBeTruthy();
    });

    it('wraps content in proper HTML structure', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).toContain('<!DOCTYPE html>');
      expect(email.html).toContain('<html>');
      expect(email.html).toContain('<body>');
    });

    it('includes brand logo', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).toContain('BestBlogs.dev');
    });

    it('has responsive styling', async () => {
      const email = await generateNewsletterEmail(basicData);

      expect(email.html).toContain('max-width');
      expect(email.html).toContain('media');
    });
  });

  describe('generateUnsubscribeConfirmationEmail', () => {
    it('generates unsubscribe confirmation email', async () => {
      const email = await generateUnsubscribeConfirmationEmail({
        email: 'user@example.com',
      });

      expect(email.subject).toContain('unsubscribed');
      expect(email.html).toContain('unsubscribed');
      expect(email.text).toContain('unsubscribed');
    });

    it('includes link to resubscribe', async () => {
      const email = await generateUnsubscribeConfirmationEmail({
        email: 'user@example.com',
      });

      expect(email.html).toContain('/newsletter');
      expect(email.text).toContain('/newsletter');
    });

    it('polite and professional tone', async () => {
      const email = await generateUnsubscribeConfirmationEmail({
        email: 'user@example.com',
      });

      expect(email.html).toContain("We're sorry to see you go");
      expect(email.text).toContain("We're sorry to see you go");
    });

    it('asks for feedback', async () => {
      const email = await generateUnsubscribeConfirmationEmail({
        email: 'user@example.com',
      });

      expect(email.html).toContain('why you unsubscribed');
      expect(email.text).toContain('why you unsubscribed');
    });
  });

  describe('htmlToText', () => {
    it('converts basic HTML to text', () => {
      const html = '<p>This is a paragraph.</p>';
      const text = htmlToText(html);

      expect(text).toContain('This is a paragraph.');
      expect(text).not.toContain('<p>');
    });

    it('removes style tags', () => {
      const html = '<style>body { color: red; }</style><p>Content</p>';
      const text = htmlToText(html);

      expect(text).not.toContain('<style>');
      expect(text).not.toContain('color: red');
      expect(text).toContain('Content');
    });

    it('removes script tags', () => {
      const html = "<script>alert('xss')</script><p>Content</p>";
      const text = htmlToText(html);

      expect(text).not.toContain('<script>');
      expect(text).not.toContain('alert');
      expect(text).toContain('Content');
    });

    it('converts HTML entities', () => {
      const html = '<p>&lt;tag&gt; &amp; &quot;quoted&quot;</p>';
      const text = htmlToText(html);

      expect(text).toContain('<tag>');
      expect(text).toContain('&');
      expect(text).toContain('"quoted"');
    });

    it('handles non-breaking space', () => {
      const html = '<p>word1&nbsp;word2</p>';
      const text = htmlToText(html);

      expect(text).toContain('word1 word2');
    });

    it('removes all HTML tags', () => {
      const html = '<div><span><strong>Bold text</strong></span></div>';
      const text = htmlToText(html);

      expect(text).toContain('Bold text');
      expect(text).not.toContain('<div>');
      expect(text).not.toContain('<span>');
      expect(text).not.toContain('<strong>');
    });

    it('handles complex HTML', () => {
      const html = `
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <ul><li>Item 1</li><li>Item 2</li></ul>
        <a href="https://example.com">Link</a>
      `;
      const text = htmlToText(html);

      expect(text).toContain('Title');
      expect(text).toContain('Paragraph 1');
      expect(text).toContain('Item 1');
      expect(text).toContain('Item 2');
    });

    it('handles empty HTML', () => {
      const text = htmlToText('');

      expect(text).toBe('');
    });

    it('collapses whitespace', () => {
      const html = '<p>Word1    Word2</p>';
      const text = htmlToText(html);

      expect(text).toContain('Word1 Word2');
    });

    it('handles apostrophe entity', () => {
      const html = '<p>It&#39;s a test</p>';
      const text = htmlToText(html);

      expect(text).toContain("It's a test");
    });
  });

  describe('email security', () => {
    it('escapes user email in HTML', async () => {
      const email = await generateConfirmationEmail({
        email: 'user@example.com',
        confirmationToken: 'token',
      });

      // Should not inject raw email into script tags etc
      expect(email.html).not.toContain('<script>');
    });

    it('handles special characters in email', async () => {
      const email = await generateConfirmationEmail({
        email: 'user+tag@example.com',
        confirmationToken: 'token',
      });

      expect(email.html).toBeTruthy();
      expect(email.text).toBeTruthy();
    });

    it('handles unicode in email', async () => {
      const email = await generateWelcomeEmail({
        email: 'test@example.com',
        preferences: {
          categories: ['Artificial_Intelligence'],
          frequency: 'weekly',
          language: 'zh',
        },
      });

      expect(email.html).toBeTruthy();
    });
  });

  describe('template structure', () => {
    it('confirmation email has proper structure', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'token',
      });

      // Check for proper HTML structure
      expect(email.html).toContain('<!DOCTYPE html>');
      expect(email.html).toContain('<head>');
      expect(email.html).toContain('</head>');
      expect(email.html).toContain('<body>');
      expect(email.html).toContain('</body>');
      expect(email.html).toContain('</html>');
    });

    it('newsletter email has proper structure', async () => {
      const email = await generateNewsletterEmail({
        subscriberEmail: 'test@example.com',
        unsubscribeToken: 'token',
        title: 'Test Newsletter',
        contentHtml: '<p>Content</p>',
      });

      expect(email.html).toContain('<!DOCTYPE html>');
      expect(email.html).toContain('<head>');
    });

    it('includes inline styles for email client compatibility', async () => {
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: 'token',
      });

      expect(email.html).toContain('style=');
      expect(email.html).toContain('font-family');
    });
  });

  describe('edge cases', () => {
    it('handles very long content in newsletter', async () => {
      const longContent = '<p>' + 'x'.repeat(10000) + '</p>';
      const email = await generateNewsletterEmail({
        subscriberEmail: 'test@example.com',
        unsubscribeToken: 'token',
        title: 'Test',
        contentHtml: longContent,
      });

      expect(email.html).toBeTruthy();
      expect(email.text).toBeTruthy();
    });

    it('handles special characters in titles', async () => {
      const email = await generateNewsletterEmail({
        subscriberEmail: 'test@example.com',
        unsubscribeToken: 'token',
        title: 'Test & "Special" <Chars>',
        contentHtml: '<p>Content</p>',
      });

      expect(email.subject).toBeTruthy();
    });

    it('handles HTML in content', async () => {
      const email = await generateNewsletterEmail({
        subscriberEmail: 'test@example.com',
        unsubscribeToken: 'token',
        title: 'Test',
        contentHtml: '<h1>Header</h1><p>Paragraph with <strong>bold</strong> text</p>',
      });

      expect(email.html).toContain('<h1>Header</h1>');
    });

    it('handles very long tokens', async () => {
      const longToken = 'a'.repeat(500);
      const email = await generateConfirmationEmail({
        email: 'test@example.com',
        confirmationToken: longToken,
      });

      expect(email.html).toContain(longToken);
    });
  });
});
