/**
 * Newsletter Generation Service
 *
 * Generates weekly newsletter content from top articles
 */

import { getSiteUrl } from '@/lib/d1';
import type { NewsletterCategory, NewsletterLanguage } from '@/lib/db/newsletter-types';
import { listNews } from '@/lib/db/queries';

export interface GenerateNewsletterOptions {
  categories?: NewsletterCategory[];
  language?: NewsletterLanguage;
  daysBack?: number;
  maxArticles?: number;
}

export interface GeneratedNewsletter {
  title: string;
  subject: string;
  previewText: string;
  contentHtml: string;
  contentText: string;
  articleIds: string[];
  categories: NewsletterCategory[];
  articleCount: number;
}

/**
 * Generate a weekly newsletter from top articles
 */
export async function generateWeeklyNewsletter(
  options: GenerateNewsletterOptions = {}
): Promise<GeneratedNewsletter> {
  const {
    categories = [
      'Artificial_Intelligence',
      'Business_Tech',
      'Programming_Technology',
      'Product_Development',
    ],
    language = 'en',
    daysBack = 7,
    maxArticles = 10,
  } = options;

  const cutoffDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  // Fetch top articles from each category
  const articlesByCategory: Map<string, any[]> = new Map();
  let allArticles: any[] = [];

  for (const category of categories) {
    const result = await listNews({
      limit: maxArticles,
      minImportance: 70,
      category,
    });

    // Filter by date
    const recentArticles = result.items.filter((a) => a.publishedAt >= cutoffDate);

    articlesByCategory.set(category, recentArticles);
    allArticles = [...allArticles, ...recentArticles];
  }

  // Sort by importance and take top articles
  allArticles.sort((a, b) => b.importance - a.importance);
  const topArticles = allArticles.slice(0, maxArticles);

  const siteUrl = await getSiteUrl();

  // Generate content
  const contentHtml = await generateNewsletterHtml(topArticles, siteUrl, language);
  const contentText = generateNewsletterText(topArticles, language);

  // Generate title and preview
  const weekNumber = getWeekNumber();
  const year = new Date().getFullYear();
  const title =
    language === 'zh'
      ? `AI News 周刊 ${year} - 第 ${weekNumber} 期`
      : `AI News Weekly ${year} - Issue #${weekNumber}`;

  const previewText =
    language === 'zh'
      ? `本周精选 ${topArticles.length} 篇高质量 AI 文章，涵盖人工智能、商业科技、软件工程和产品设计等领域。`
      : `Top ${topArticles.length} curated AI articles from the past week covering AI, business tech, software engineering, and product design.`;

  return {
    title,
    subject: title,
    previewText,
    contentHtml,
    contentText,
    articleIds: topArticles.map((a) => a.id),
    categories,
    articleCount: topArticles.length,
  };
}

/**
 * Generate HTML content for newsletter
 */
async function generateNewsletterHtml(
  articles: Array<{
    id: string;
    title: string;
    summary?: string | null;
    sourceName: string;
    publishedAt: number;
    category?: string | null;
    url: string;
  }>,
  siteUrl: string,
  language: string
): Promise<string> {
  const today = new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a;">
      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #000;">
        ${language === 'zh' ? '本周精选' : "This Week's Highlights"}
      </h2>
      <p style="font-size: 14px; color: #666; margin-bottom: 24px;">
        ${today} ${language === 'zh' ? '精选内容' : 'curated content'}
      </p>
  `;

  for (const article of articles) {
    html += `
      <div style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e5e5;">
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px;">
          <a href="${siteUrl}/news/${article.id}" style="color: #000; text-decoration: none;">
            ${article.title}
          </a>
        </h3>
        ${article.summary ? `<p style="font-size: 14px; color: #444; margin: 0 0 8px;">${article.summary}</p>` : ''}
        <div style="font-size: 12px; color: #888;">
          <span>${article.sourceName}</span>
          <span style="margin: 0 8px;">•</span>
          <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
          ${article.category ? `<span style="margin: 0 8px;">•</span><span>${article.category}</span>` : ''}
        </div>
      </div>
    `;
  }

  html += `
    <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid #e5e5e5; text-align: center;">
      <p style="font-size: 14px; color: #666; margin: 0 0 16px;">
        ${language === 'zh' ? '查看更多文章，请访问' : 'Read more at'}
        <a href="${siteUrl}" style="color: #0066cc; text-decoration: none;">BestBlogs.dev</a>
      </p>
    </div>
  `;

  return html;
}

/**
 * Generate text content for newsletter
 */
function generateNewsletterText(
  articles: Array<{
    id: string;
    title: string;
    summary?: string | null;
    sourceName: string;
    publishedAt: number;
    url: string;
  }>,
  language: string
): string {
  const today = new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text =
    language === 'zh' ? `本周精选 - ${today}\n\n` : `This Week's Highlights - ${today}\n\n`;

  for (const article of articles) {
    text += `${article.title}\n`;
    text += `${article.summary || ''}\n`;
    text += `Source: ${article.sourceName} | `;
    text += `Date: ${new Date(article.publishedAt).toLocaleDateString()}\n`;
    text += `Read: ${article.url}\n\n`;
    text += `${'-'.repeat(40)}\n\n`;
  }

  return text;
}

/**
 * Get ISO week number
 */
function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(diff / oneWeek) + 1;
}

/**
 * Generate category-specific newsletter
 */
export async function generateCategoryNewsletter(
  category: NewsletterCategory,
  language: NewsletterLanguage = 'en',
  daysBack: number = 7
): Promise<GeneratedNewsletter> {
  const cutoffDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  const result = await listNews({
    limit: 20,
    minImportance: 70,
    category,
  });

  const articles = result.items.filter((a) => a.publishedAt >= cutoffDate).slice(0, 10);

  const siteUrl = await getSiteUrl();

  const categoryNames: Record<NewsletterCategory, { en: string; zh: string }> = {
    Artificial_Intelligence: {
      en: 'Artificial Intelligence',
      zh: '人工智能',
    },
    Business_Tech: { en: 'Business & Technology', zh: '商业科技' },
    Programming_Technology: { en: 'Programming', zh: '软件编程' },
    Product_Development: { en: 'Product Development', zh: '产品设计' },
  };

  const categoryName = categoryNames[category][language];

  const contentHtml = await generateNewsletterHtml(articles, siteUrl, language);
  const contentText = generateNewsletterText(articles, language);

  const weekNumber = getWeekNumber();

  return {
    title:
      language === 'zh'
        ? `${categoryName} 周刊 - 第 ${weekNumber} 期`
        : `${categoryName} Weekly - Issue #${weekNumber}`,
    subject:
      language === 'zh'
        ? `${categoryName} 周刊 - 第 ${weekNumber} 期`
        : `${categoryName} Weekly - Issue #${weekNumber}`,
    previewText:
      language === 'zh'
        ? `本周 ${categoryName} 领域精选 ${articles.length} 篇高质量文章`
        : `Top ${articles.length} curated ${categoryName} articles from this week`,
    contentHtml,
    contentText,
    articleIds: articles.map((a) => a.id),
    categories: [category],
    articleCount: articles.length,
  };
}
