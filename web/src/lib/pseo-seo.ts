import type { WithContext, CollectionPage, Organization, ItemList, WebPage } from 'schema-dts';

import { getSiteUrl } from './d1';
import type { TopicPage, Company, LearningPath, ComparisonPage, BreadcrumbItem } from './db/types';

// =============================================================================
// Breadcrumb JSON-LD
// =============================================================================

export async function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): Promise<string> {
  const baseUrl = await getSiteUrl();

  const itemList: ItemList = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${baseUrl}${item.href}`,
    })),
  };

  return JSON.stringify({ '@context': 'https://schema.org', ...itemList });
}

// =============================================================================
// Topic Page JSON-LD
// =============================================================================

export async function generateTopicPageJsonLd(topic: TopicPage): Promise<string> {
  const baseUrl = await getSiteUrl();
  const url = `${baseUrl}/topic/${topic.slug}`;

  const jsonLd: WithContext<CollectionPage | WebPage> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: topic.metaTitle || `${topic.name} - AI News & Resources`,
    description:
      topic.metaDescription || topic.description || `Latest news and resources about ${topic.name}`,
    url,
    inLanguage: 'en-US',
    about: {
      '@type': 'Thing',
      name: topic.name,
      description: topic.description ?? undefined,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: topic.newsCount,
      itemListElement:
        topic.recentNews?.map((news, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'NewsArticle',
            headline: news.title,
            url: `${baseUrl}/news/${news.id}`,
            datePublished: new Date(news.publishedAt).toISOString(),
          },
        })) ?? [],
    },
  };

  return JSON.stringify(jsonLd);
}

// =============================================================================
// Company Page JSON-LD
// =============================================================================

export async function generateCompanyPageJsonLd(company: Company): Promise<string> {
  const baseUrl = await getSiteUrl();
  const url = `${baseUrl}/company/${company.slug}`;

  const org: Organization = {
    '@type': 'Organization',
    name: company.name,
    legalName: company.legalName ?? undefined,
    description: company.description ?? undefined,
    url: company.website ?? undefined,
    logo: company.logoUrl ?? undefined,
    address: company.headquarters
      ? {
          '@type': 'PostalAddress',
          addressLocality: company.headquarters,
        }
      : undefined,
    sameAs: [
      company.linkedinUrl ?? undefined,
      company.twitterHandle ? `https://twitter.com/${company.twitterHandle}` : undefined,
    ].filter((s): s is string => Boolean(s)),
  } as Organization;

  const page: WithContext<WebPage> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: company.metaTitle || `${company.name} - Company Profile`,
    description:
      company.metaDescription || company.description || `Latest news about ${company.name}`,
    url,
    about: org,
    mainEntity: org,
  };

  return JSON.stringify(page);
}

// =============================================================================
// Learning Path JSON-LD
// =============================================================================

export async function generateLearningPathJsonLd(path: LearningPath): Promise<string> {
  const baseUrl = await getSiteUrl();
  const url = `${baseUrl}/learn/${path.slug}`;

  const jsonLd: WithContext<CollectionPage> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: path.metaTitle || `${path.title} - Learning Path`,
    description: path.metaDescription || path.description || `Learn ${path.title} step by step`,
    url,
    educationalLevel: path.difficulty ?? undefined,
    educationalUse: 'Learning Path',
    timeRequired: path.estimatedHours ? `PT${path.estimatedHours}H` : undefined,
    teaches: path.topics,
  };

  return JSON.stringify(jsonLd);
}

// =============================================================================
// Comparison Page JSON-LD
// =============================================================================

export async function generateComparisonPageJsonLd(comparison: ComparisonPage): Promise<string> {
  const baseUrl = await getSiteUrl();
  const url = `${baseUrl}/compare/${comparison.slug}`;

  const jsonLd: WithContext<WebPage> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: comparison.metaTitle || comparison.title,
    description: comparison.metaDescription || comparison.description || undefined,
    url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          item: {
            '@type': 'Thing',
            name: comparison.entityAId ?? '',
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          item: {
            '@type': 'Thing',
            name: comparison.entityBId ?? '',
          },
        },
      ],
    },
  };

  return JSON.stringify(jsonLd);
}

// =============================================================================
// Role Page JSON-LD
// =============================================================================

export async function generateRolePageJsonLd(
  role: string,
  title: string,
  description: string
): Promise<string> {
  const baseUrl = await getSiteUrl();
  const url = `${baseUrl}/for/${role}`;

  const jsonLd: WithContext<CollectionPage> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    audience: {
      '@type': 'Audience',
      audienceType: role,
    },
  };

  return JSON.stringify(jsonLd);
}

// =============================================================================
// Metadata Generators
// =============================================================================

export async function generateTopicMetadata(topic: TopicPage): Promise<{
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: { url: string; width: number; height: number }[];
  };
}> {
  const baseUrl = await getSiteUrl();
  const title = topic.metaTitle || `${topic.name} - AI News & Resources`;
  const description =
    topic.metaDescription ||
    topic.description ||
    `Latest news, updates, and resources about ${topic.name}`;
  const canonical = `${baseUrl}/topic/${topic.slug}`;
  const ogImage = `${baseUrl}/og/topic/${topic.slug}`;

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export async function generateCompanyMetadata(company: Company): Promise<{
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: { url: string; width: number; height: number }[];
  };
}> {
  const baseUrl = await getSiteUrl();
  const title = company.metaTitle || `${company.name} - Company Profile`;
  const description =
    company.metaDescription ||
    company.description ||
    `Latest news, updates, and insights about ${company.name}`;
  const canonical = `${baseUrl}/company/${company.slug}`;
  const ogImage = company.logoUrl || `${baseUrl}/og/company/${company.slug}`;

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export async function generateLearningPathMetadata(path: LearningPath): Promise<{
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: { url: string; width: number; height: number }[];
  };
}> {
  const baseUrl = await getSiteUrl();
  const title = path.metaTitle || `${path.title} - Learning Path`;
  const description =
    path.metaDescription ||
    path.description ||
    `Master ${path.title} with this comprehensive learning path`;
  const canonical = `${baseUrl}/learn/${path.slug}`;
  const ogImage = `${baseUrl}/og/learn/${path.slug}`;

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export async function generateComparisonMetadata(comparison: ComparisonPage): Promise<{
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: { url: string; width: number; height: number }[];
  };
}> {
  const baseUrl = await getSiteUrl();
  const title = comparison.metaTitle || comparison.title;
  const description =
    comparison.metaDescription || comparison.description || `Compare features, pricing, and more`;
  const canonical = `${baseUrl}/compare/${comparison.slug}`;
  const ogImage = `${baseUrl}/og/compare/${comparison.slug}`;

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export async function generateRoleMetadata(
  role: string,
  title: string,
  description: string
): Promise<{
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
    images: { url: string; width: number; height: number }[];
  };
}> {
  const baseUrl = await getSiteUrl();
  const canonical = `${baseUrl}/for/${role}`;
  const ogImage = `${baseUrl}/og/role/${role}`;

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

// =============================================================================
// Slug generators
// =============================================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function generateComparisonSlug(entityA: string, entityB: string): string {
  const [first, second] = [entityA, entityB].sort();
  return `${slugify(first!)}-vs-${slugify(second!)}`;
}
