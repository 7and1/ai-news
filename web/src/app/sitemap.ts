import type { MetadataRoute } from 'next';

import { getDb, getSiteUrl } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();
  const db = await getDb();

  // Get news URLs
  const newsRows = await db
    .prepare(
      `
      SELECT id, updated_at
      FROM news
      WHERE importance >= 50
      ORDER BY published_at DESC
      LIMIT 50000
    `
    )
    .all();

  const newsResults = (newsRows.results ?? []) as {
    id: string;
    updated_at: number;
  }[];
  const newsUrls = newsResults.map((r) => ({
    url: `${baseUrl}/news/${r.id}`,
    lastModified: new Date(Number(r.updated_at ?? Date.now())),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Get topic pages
  const topicRows = await db
    .prepare(
      `
      SELECT slug, updated_at, news_count
      FROM topic_pages
      WHERE is_active = 1 AND news_count > 0
      ORDER BY news_count DESC
    `
    )
    .all();

  const topicResults = (topicRows.results ?? []) as {
    slug: string;
    updated_at: number;
    news_count: number;
  }[];
  const topicUrls = topicResults.map((r) => ({
    url: `${baseUrl}/topic/${r.slug}`,
    lastModified: new Date(Number(r.updated_at ?? Date.now())),
    changeFrequency: 'daily' as const,
    priority: r.news_count > 10 ? 0.9 : 0.7,
  }));

  // Get company pages
  const companyRows = await db
    .prepare(
      `
      SELECT slug, updated_at, news_count
      FROM companies
      WHERE is_active = 1 AND news_count > 0
      ORDER BY news_count DESC
    `
    )
    .all();

  const companyResults = (companyRows.results ?? []) as {
    slug: string;
    updated_at: number;
    news_count: number;
  }[];
  const companyUrls = companyResults.map((r) => ({
    url: `${baseUrl}/company/${r.slug}`,
    lastModified: new Date(Number(r.updated_at ?? Date.now())),
    changeFrequency: 'daily' as const,
    priority: r.news_count > 10 ? 0.9 : 0.7,
  }));

  // Get learning paths
  const pathRows = await db
    .prepare(
      `
      SELECT slug, updated_at
      FROM learning_paths
      WHERE is_active = 1
      ORDER BY enrollment_count DESC
    `
    )
    .all();

  const pathResults = (pathRows.results ?? []) as {
    slug: string;
    updated_at: number;
  }[];
  const pathUrls = pathResults.map((r) => ({
    url: `${baseUrl}/learn/${r.slug}`,
    lastModified: new Date(Number(r.updated_at ?? Date.now())),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Get comparison pages
  const comparisonRows = await db
    .prepare(
      `
      SELECT slug, updated_at, view_count
      FROM comparison_pages
      WHERE is_active = 1
      ORDER BY view_count DESC
    `
    )
    .all();

  const comparisonResults = (comparisonRows.results ?? []) as {
    slug: string;
    updated_at: number;
    view_count: number;
  }[];
  const comparisonUrls = comparisonResults.map((r) => ({
    url: `${baseUrl}/compare/${r.slug}`,
    lastModified: new Date(Number(r.updated_at ?? Date.now())),
    changeFrequency: 'weekly' as const,
    priority: r.view_count > 100 ? 0.8 : 0.6,
  }));

  // Role-based pages
  const roles = [
    'developers',
    'product-managers',
    'designers',
    'data-scientists',
    'executives',
    'entrepreneurs',
    'researchers',
    'students',
  ] as const;
  const roleUrls = roles.map((role) => ({
    url: `${baseUrl}/for/${role}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/latest`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/topics`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/learn`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/rss.xml`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.4,
    },
  ];

  return [
    ...staticPages,
    ...roleUrls,
    ...newsUrls,
    ...topicUrls,
    ...companyUrls,
    ...pathUrls,
    ...comparisonUrls,
  ];
}

// Separate sitemap for news only (for larger sites)
export async function generateNewsSitemap(): Promise<string> {
  const baseUrl = await getSiteUrl();
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT id, updated_at
      FROM news
      WHERE importance >= 40
      ORDER BY published_at DESC
    `
    )
    .all();

  const results = (rows.results ?? []) as { id: string; updated_at: number }[];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${results
  .map(
    (r) => `  <url>
    <loc>${baseUrl}/news/${r.id}</loc>
    <lastmod>${new Date(Number(r.updated_at ?? Date.now())).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xml;
}

// Separate sitemap for topics
export async function generateTopicsSitemap(): Promise<string> {
  const baseUrl = await getSiteUrl();
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT slug, updated_at
      FROM topic_pages
      WHERE is_active = 1
    `
    )
    .all();

  const results = (rows.results ?? []) as {
    slug: string;
    updated_at: number;
  }[];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${results
  .map(
    (r) => `  <url>
    <loc>${baseUrl}/topic/${r.slug}</loc>
    <lastmod>${new Date(Number(r.updated_at ?? Date.now())).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xml;
}

// Separate sitemap for companies
export async function generateCompaniesSitemap(): Promise<string> {
  const baseUrl = await getSiteUrl();
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT slug, updated_at
      FROM companies
      WHERE is_active = 1
    `
    )
    .all();

  const results = (rows.results ?? []) as {
    slug: string;
    updated_at: number;
  }[];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${results
  .map(
    (r) => `  <url>
    <loc>${baseUrl}/company/${r.slug}</loc>
    <lastmod>${new Date(Number(r.updated_at ?? Date.now())).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xml;
}
