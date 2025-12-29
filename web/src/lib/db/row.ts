import type {
  Company,
  LearningPath,
  News,
  NewsEntities,
  NewsListItem,
  SourceCategory,
  SourceType,
  TopicPage,
  TopicType,
  ComparisonPage,
} from './types';

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {return tags.filter((t) => typeof t === 'string');}
  if (typeof tags !== 'string' || tags.trim() === '') {return [];}
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => typeof t === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function parseEntities(entities: unknown): NewsEntities | null {
  if (isNullish(entities)) {return null;}
  if (typeof entities === 'object' && entities !== null) {
    const e = entities as Record<string, unknown>;
    return {
      companies: Array.isArray(e.companies) ? e.companies.map(String) : [],
      models: Array.isArray(e.models) ? e.models.map(String) : [],
      technologies: Array.isArray(e.technologies) ? e.technologies.map(String) : [],
      concepts: Array.isArray(e.concepts) ? e.concepts.map(String) : [],
    };
  }
  if (typeof entities !== 'string' || entities.trim() === '') {return null;}
  try {
    const parsed = JSON.parse(entities);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        companies: Array.isArray(parsed.companies) ? parsed.companies.map(String) : [],
        models: Array.isArray(parsed.models) ? parsed.models.map(String) : [],
        technologies: Array.isArray(parsed.technologies) ? parsed.technologies.map(String) : [],
        concepts: Array.isArray(parsed.concepts) ? parsed.concepts.map(String) : [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function mapNewsRow(row: Record<string, unknown>): News {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: isNullish(row.summary) ? null : String(row.summary),
    oneLine: isNullish(row.one_line) ? null : String(row.one_line),
    content: isNullish(row.content) ? null : String(row.content),
    url: String(row.url),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name ?? ''),
    sourceType: String(row.source_type ?? 'blog') as SourceType,
    sourceCategory: (isNullish(row.source_category)
      ? null
      : String(row.source_category)) as SourceCategory | null,
    category: isNullish(row.category) ? null : String(row.category),
    tags: parseTags(row.tags),
    importance: Number(row.importance ?? 50),
    sentiment: isNullish(row.sentiment) ? null : String(row.sentiment),
    language: String(row.language ?? 'en'),
    ogImage: isNullish(row.og_image) ? null : String(row.og_image),
    publishedAt: Number(row.published_at),
    crawledAt: Number(row.crawled_at),
    updatedAt: Number(row.updated_at ?? row.published_at),
    entities: parseEntities(row.entities),
  };
}

export function toListItem(news: News): NewsListItem {
  return {
    id: news.id,
    title: news.title,
    summary: news.summary,
    oneLine: news.oneLine,
    url: news.url,
    sourceName: news.sourceName,
    sourceType: news.sourceType,
    sourceCategory: news.sourceCategory,
    category: news.category,
    tags: news.tags,
    importance: news.importance,
    language: news.language,
    publishedAt: news.publishedAt,
    updatedAt: news.updatedAt,
  };
}

export function mapTopicRow(row: Record<string, unknown>): TopicPage {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: isNullish(row.description) ? null : String(row.description),
    type: String(row.type) as TopicType,
    parentTopicId: isNullish(row.parent_topic_id) ? null : String(row.parent_topic_id),
    aliases: parseTags(row.aliases),
    metaTitle: isNullish(row.meta_title) ? null : String(row.meta_title),
    metaDescription: isNullish(row.meta_description) ? null : String(row.meta_description),
    contentHtml: isNullish(row.content_html) ? null : String(row.content_html),
    newsCount: Number(row.news_count ?? 0),
    lastNewsUpdatedAt: isNullish(row.last_news_updated_at) ? null : Number(row.last_news_updated_at),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
  };
}

export function mapCompanyRow(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    legalName: isNullish(row.legal_name) ? null : String(row.legal_name),
    description: isNullish(row.description) ? null : String(row.description),
    foundedYear: isNullish(row.founded_year) ? null : Number(row.founded_year),
    headquarters: isNullish(row.headquarters) ? null : String(row.headquarters),
    website: isNullish(row.website) ? null : String(row.website),
    twitterHandle: isNullish(row.twitter_handle) ? null : String(row.twitter_handle),
    linkedinUrl: isNullish(row.linkedin_url) ? null : String(row.linkedin_url),
    logoUrl: isNullish(row.logo_url) ? null : String(row.logo_url),
    industry: isNullish(row.industry) ? null : String(row.industry),
    metaTitle: isNullish(row.meta_title) ? null : String(row.meta_title),
    metaDescription: isNullish(row.meta_description) ? null : String(row.meta_description),
    contentHtml: isNullish(row.content_html) ? null : String(row.content_html),
    newsCount: Number(row.news_count ?? 0),
    lastNewsUpdatedAt: isNullish(row.last_news_updated_at) ? null : Number(row.last_news_updated_at),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
  };
}

export function mapLearningPathRow(row: Record<string, unknown>): LearningPath {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: isNullish(row.description) ? null : String(row.description),
    difficulty: (row.difficulty as 'beginner' | 'intermediate' | 'advanced' | null) ?? null,
    estimatedHours: isNullish(row.estimated_hours) ? null : Number(row.estimated_hours),
    topics: parseTags(row.topics),
    prerequisites: parseTags(row.prerequisites),
    metaTitle: isNullish(row.meta_title) ? null : String(row.meta_title),
    metaDescription: isNullish(row.meta_description) ? null : String(row.meta_description),
    contentHtml: isNullish(row.content_html) ? null : String(row.content_html),
    enrollmentCount: Number(row.enrollment_count ?? 0),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
  };
}

export function mapComparisonPageRow(row: Record<string, unknown>): ComparisonPage {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: isNullish(row.description) ? null : String(row.description),
    comparisonType: isNullish(row.comparison_type) ? null : String(row.comparison_type),
    entityAType: isNullish(row.entity_a_type) ? null : String(row.entity_a_type),
    entityAId: isNullish(row.entity_a_id) ? null : String(row.entity_a_id),
    entityBType: isNullish(row.entity_b_type) ? null : String(row.entity_b_type),
    entityBId: isNullish(row.entity_b_id) ? null : String(row.entity_b_id),
    metaTitle: isNullish(row.meta_title) ? null : String(row.meta_title),
    metaDescription: isNullish(row.meta_description) ? null : String(row.meta_description),
    contentHtml: isNullish(row.content_html) ? null : String(row.content_html),
    viewCount: Number(row.view_count ?? 0),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
  };
}
