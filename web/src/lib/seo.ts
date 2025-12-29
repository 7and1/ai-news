import type { WithContext, NewsArticle, WebSite } from 'schema-dts';

import { getSiteUrl } from '@/lib/d1';
import type { News } from '@/lib/db/types';

export async function generateWebSiteJsonLd(): Promise<string> {
  const baseUrl = await getSiteUrl();
  const jsonLd: WithContext<WebSite> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AI News',
    url: baseUrl,
    description:
      'Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    } as unknown as WebSite['potentialAction'],
  };

  return JSON.stringify(jsonLd);
}

export async function generateNewsArticleJsonLd(news: News): Promise<string> {
  const baseUrl = await getSiteUrl();
  const jsonLd: WithContext<NewsArticle> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    description: news.summary ?? news.oneLine ?? undefined,
    datePublished: new Date(news.publishedAt).toISOString(),
    dateModified: new Date(news.updatedAt).toISOString(),
    author: {
      '@type': 'Organization',
      name: news.sourceName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AI News',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/icon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/news/${news.id}`,
    },
    articleSection: news.category ?? undefined,
    keywords: news.tags.length ? news.tags.join(', ') : undefined,
    inLanguage: news.language === 'zh' ? 'zh-CN' : 'en-US',
    image: news.ogImage ? [news.ogImage] : [`${baseUrl}/og/${news.id}`],
  };

  return JSON.stringify(jsonLd);
}
