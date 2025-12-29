import type { Metadata } from 'next';

import { getSiteUrl } from '@/lib/d1';
import type { News } from '@/lib/db/types';

export async function generateNewsMetadata(news: News): Promise<Metadata> {
  const baseUrl = await getSiteUrl();
  const title = `${news.title} | AI News`;
  const description = news.oneLine || news.summary || news.title;
  const image = news.ogImage || `${baseUrl}/og/${news.id}`;
  const canonical = `${baseUrl}/news/${news.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      siteName: 'AI News',
      title: news.title,
      description,
      url: canonical,
      locale: news.language === 'zh' ? 'zh_CN' : 'en_US',
      publishedTime: new Date(news.publishedAt).toISOString(),
      modifiedTime: new Date(news.updatedAt).toISOString(),
      authors: [news.sourceName],
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description,
      images: [image],
    },
  };
}
