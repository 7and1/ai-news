import { getDb } from '@/lib/d1';

import {
  mapCompanyRow,
  mapLearningPathRow,
  mapTopicRow,
  mapComparisonPageRow,
  toListItem,
  mapNewsRow,
} from './row';
import type {
  Company,
  LearningPath,
  TopicPage,
  ComparisonPage,
  TopicType,
  UserRole,
  NewsListItem,
} from './types';

// =============================================================================
// Topic Pages Queries
// =============================================================================

export async function getTopicBySlug(slug: string): Promise<TopicPage | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM topic_pages WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!row) {
    return null;
  }
  return mapTopicRow(row as Record<string, unknown>);
}

export async function getTopicById(id: string): Promise<TopicPage | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM topic_pages WHERE id = ? AND is_active = 1')
    .bind(id)
    .first();

  if (!row) {
    return null;
  }
  return mapTopicRow(row as Record<string, unknown>);
}

export async function listTopics(
  input: {
    limit?: number;
    offset?: number;
    type?: TopicType;
    minNewsCount?: number;
    parentId?: string | null;
  } = {}
): Promise<{ items: TopicPage[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const where: string[] = ['is_active = 1'];
  const binds: unknown[] = [];

  if (input.type) {
    where.push('type = ?');
    binds.push(input.type);
  }
  if (input.minNewsCount) {
    where.push('news_count >= ?');
    binds.push(input.minNewsCount);
  }
  if (input.parentId === null) {
    where.push('parent_topic_id IS NULL');
  } else if (input.parentId) {
    where.push('parent_topic_id = ?');
    binds.push(input.parentId);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM topic_pages WHERE ${where.join(' AND ')}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  const rows = await db
    .prepare(
      `SELECT * FROM topic_pages WHERE ${where.join(' AND ')}
       ORDER BY news_count DESC, name ASC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = ((rows.results ?? []) as Record<string, unknown>[]).map(mapTopicRow);

  return { items, total };
}

export async function getTopicWithNews(slug: string, limit = 20): Promise<TopicPage | null> {
  const db = await getDb();

  const topicRow = await db
    .prepare('SELECT * FROM topic_pages WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!topicRow) {
    return null;
  }
  const topic = mapTopicRow(topicRow as Record<string, unknown>);

  // Get related news
  const newsRows = await db
    .prepare(
      `
      SELECT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
      FROM topic_news tn
      JOIN news n ON n.id = tn.news_id
      JOIN sources s ON s.id = n.source_id
      WHERE tn.topic_id = ?
      ORDER BY tn.relevance_score DESC, n.published_at DESC
      LIMIT ?
      `
    )
    .bind(topic.id, limit)
    .all();

  const news = ((newsRows.results ?? []) as Record<string, unknown>[])
    .map(mapNewsRow)
    .map(toListItem);

  return { ...topic, recentNews: news };
}

export async function getTopicChildren(parentId: string): Promise<TopicPage[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT * FROM topic_pages WHERE parent_topic_id = ? AND is_active = 1 ORDER BY name ASC`
    )
    .bind(parentId)
    .all();

  return ((rows.results ?? []) as Record<string, unknown>[]).map(mapTopicRow);
}

export async function listTopicsByType(): Promise<Record<TopicType, TopicPage[]>> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT * FROM topic_pages WHERE is_active = 1 AND news_count > 0 ORDER BY type ASC, news_count DESC`
    )
    .all();

  const items = ((rows.results ?? []) as Record<string, unknown>[]).map(mapTopicRow);

  return {
    model: items.filter((t) => t.type === 'model'),
    technology: items.filter((t) => t.type === 'technology'),
    concept: items.filter((t) => t.type === 'concept'),
    company: items.filter((t) => t.type === 'company'),
  };
}

export async function upsertTopic(input: {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  type: TopicType;
  parentTopicId?: string | null;
  aliases?: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  contentHtml?: string | null;
}): Promise<{ id: string }> {
  const db = await getDb();
  const id = input.id ?? `topic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const aliases = JSON.stringify(input.aliases ?? []);

  await db
    .prepare(
      `
      INSERT INTO topic_pages (
        id, slug, name, description, type, parent_topic_id, aliases,
        meta_title, meta_description, content_html
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        type = excluded.type,
        parent_topic_id = excluded.parent_topic_id,
        aliases = excluded.aliases,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        content_html = excluded.content_html
      `
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.description ?? null,
      input.type,
      input.parentTopicId ?? null,
      aliases,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      input.contentHtml ?? null
    )
    .run();

  return { id };
}

export async function linkNewsToTopic(input: {
  topicId: string;
  newsId: string;
  relevanceScore?: number;
}): Promise<void> {
  const db = await getDb();
  const score = input.relevanceScore ?? 50;

  await db
    .prepare(
      `
      INSERT INTO topic_news (topic_id, news_id, relevance_score)
      VALUES (?, ?, ?)
      ON CONFLICT(topic_id, news_id) DO UPDATE SET
        relevance_score = excluded.relevance_score
      `
    )
    .bind(input.topicId, input.newsId, score)
    .run();

  // Update topic news count
  await updateTopicNewsCount(input.topicId);
}

async function updateTopicNewsCount(topicId: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `
      UPDATE topic_pages
      SET news_count = (
        SELECT COUNT(*) FROM topic_news WHERE topic_id = ?
      ),
      last_news_updated_at = (
        SELECT MAX(n.published_at)
        FROM topic_news tn
        JOIN news n ON n.id = tn.news_id
        WHERE tn.topic_id = ?
      )
      WHERE id = ?
      `
    )
    .bind(topicId, topicId, topicId)
    .run();
}

// =============================================================================
// Company Queries
// =============================================================================

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM companies WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!row) {
    return null;
  }
  return mapCompanyRow(row as Record<string, unknown>);
}

export async function getCompanyWithNews(slug: string, limit = 20): Promise<Company | null> {
  const db = await getDb();

  const companyRow = await db
    .prepare('SELECT * FROM companies WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!companyRow) {
    return null;
  }
  const company = mapCompanyRow(companyRow as Record<string, unknown>);

  // Get related news
  const newsRows = await db
    .prepare(
      `
      SELECT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
      FROM company_news cn
      JOIN news n ON n.id = cn.news_id
      JOIN sources s ON s.id = n.source_id
      WHERE cn.company_id = ?
      ORDER BY cn.relevance_score DESC, n.published_at DESC
      LIMIT ?
      `
    )
    .bind(company.id, limit)
    .all();

  const news = ((newsRows.results ?? []) as Record<string, unknown>[])
    .map(mapNewsRow)
    .map(toListItem);

  return { ...company, recentNews: news };
}

export async function listCompanies(
  input: {
    limit?: number;
    offset?: number;
    industry?: string;
    minNewsCount?: number;
  } = {}
): Promise<{ items: Company[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const where: string[] = ['is_active = 1'];
  const binds: unknown[] = [];

  if (input.industry) {
    where.push('industry = ?');
    binds.push(input.industry);
  }
  if (input.minNewsCount) {
    where.push('news_count >= ?');
    binds.push(input.minNewsCount);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM companies WHERE ${where.join(' AND ')}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  const rows = await db
    .prepare(
      `SELECT * FROM companies WHERE ${where.join(' AND ')}
       ORDER BY news_count DESC, name ASC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = ((rows.results ?? []) as Record<string, unknown>[]).map(mapCompanyRow);

  return { items, total };
}

export async function listCompanyIndustries(): Promise<{ industry: string; count: number }[]> {
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT industry, COUNT(*) as count
      FROM companies
      WHERE is_active = 1 AND industry IS NOT NULL
      GROUP BY industry
      ORDER BY count DESC
      `
    )
    .all();

  return ((rows.results ?? []) as { industry: string; count: number }[]).map((r) => ({
    industry: String(r.industry),
    count: Number(r.count),
  }));
}

export async function upsertCompany(input: {
  id?: string;
  slug: string;
  name: string;
  legalName?: string | null;
  description?: string | null;
  foundedYear?: number | null;
  headquarters?: string | null;
  website?: string | null;
  twitterHandle?: string | null;
  linkedinUrl?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  contentHtml?: string | null;
}): Promise<{ id: string }> {
  const db = await getDb();
  const id = input.id ?? `company_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await db
    .prepare(
      `
      INSERT INTO companies (
        id, slug, name, legal_name, description, founded_year, headquarters,
        website, twitter_handle, linkedin_url, logo_url, industry,
        meta_title, meta_description, content_html
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        legal_name = excluded.legal_name,
        description = excluded.description,
        founded_year = excluded.founded_year,
        headquarters = excluded.headquarters,
        website = excluded.website,
        twitter_handle = excluded.twitter_handle,
        linkedin_url = excluded.linkedin_url,
        logo_url = excluded.logo_url,
        industry = excluded.industry,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        content_html = excluded.content_html
      `
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.legalName ?? null,
      input.description ?? null,
      input.foundedYear ?? null,
      input.headquarters ?? null,
      input.website ?? null,
      input.twitterHandle ?? null,
      input.linkedinUrl ?? null,
      input.logoUrl ?? null,
      input.industry ?? null,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      input.contentHtml ?? null
    )
    .run();

  return { id };
}

export async function linkNewsToCompany(input: {
  companyId: string;
  newsId: string;
  relevanceScore?: number;
}): Promise<void> {
  const db = await getDb();
  const score = input.relevanceScore ?? 50;

  await db
    .prepare(
      `
      INSERT INTO company_news (company_id, news_id, relevance_score)
      VALUES (?, ?, ?)
      ON CONFLICT(company_id, news_id) DO UPDATE SET
        relevance_score = excluded.relevance_score
      `
    )
    .bind(input.companyId, input.newsId, score)
    .run();

  // Update company news count
  await updateCompanyNewsCount(input.companyId);
}

async function updateCompanyNewsCount(companyId: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `
      UPDATE companies
      SET news_count = (
        SELECT COUNT(*) FROM company_news WHERE company_id = ?
      ),
      last_news_updated_at = (
        SELECT MAX(n.published_at)
        FROM company_news cn
        JOIN news n ON n.id = cn.news_id
        WHERE cn.company_id = ?
      )
      WHERE id = ?
      `
    )
    .bind(companyId, companyId, companyId)
    .run();
}

// =============================================================================
// Learning Path Queries
// =============================================================================

export async function getLearningPathBySlug(slug: string): Promise<LearningPath | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM learning_paths WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!row) {
    return null;
  }
  return mapLearningPathRow(row as Record<string, unknown>);
}

export async function listLearningPaths(
  input: {
    limit?: number;
    offset?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  } = {}
): Promise<{ items: LearningPath[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const where: string[] = ['is_active = 1'];
  const binds: unknown[] = [];

  if (input.difficulty) {
    where.push('difficulty = ?');
    binds.push(input.difficulty);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM learning_paths WHERE ${where.join(' AND ')}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  const rows = await db
    .prepare(
      `SELECT * FROM learning_paths WHERE ${where.join(' AND ')}
       ORDER BY enrollment_count DESC, title ASC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = ((rows.results ?? []) as Record<string, unknown>[]).map(mapLearningPathRow);

  return { items, total };
}

// =============================================================================
// Comparison Page Queries
// =============================================================================

export async function getComparisonBySlug(slug: string): Promise<ComparisonPage | null> {
  const db = await getDb();
  const row = await db
    .prepare('SELECT * FROM comparison_pages WHERE slug = ? AND is_active = 1')
    .bind(slug)
    .first();

  if (!row) {
    return null;
  }
  return mapComparisonPageRow(row as Record<string, unknown>);
}

export async function listComparisons(
  input: {
    limit?: number;
    offset?: number;
    comparisonType?: string;
  } = {}
): Promise<{ items: ComparisonPage[]; total: number }> {
  const db = await getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const where: string[] = ['is_active = 1'];
  const binds: unknown[] = [];

  if (input.comparisonType) {
    where.push('comparison_type = ?');
    binds.push(input.comparisonType);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM comparison_pages WHERE ${where.join(' AND ')}`)
    .bind(...binds)
    .first();
  const total = Number((countResult as { count: number })?.count ?? 0);

  const rows = await db
    .prepare(
      `SELECT * FROM comparison_pages WHERE ${where.join(' AND ')}
       ORDER BY view_count DESC, title ASC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  const items = ((rows.results ?? []) as Record<string, unknown>[]).map(mapComparisonPageRow);

  return { items, total };
}

// =============================================================================
// Related Articles by Entities
// =============================================================================

export async function getRelatedArticlesByEntities(
  newsId: string,
  limit = 6
): Promise<NewsListItem[]> {
  const db = await getDb();

  const rows = await db
    .prepare(
      `
      SELECT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
      FROM news n
      JOIN sources s ON s.id = n.source_id
      WHERE n.id != ?
        AND n.entities IS NOT NULL
        AND n.importance >= 40
      ORDER BY n.published_at DESC
      LIMIT ?
      `
    )
    .bind(newsId, limit * 3) // Get more to filter by entity overlap
    .all();

  const allArticles = ((rows.results ?? []) as Record<string, unknown>[])
    .map(mapNewsRow)
    .map(toListItem);

  // Get the original article's entities
  const originalRow = await db
    .prepare('SELECT entities FROM news WHERE id = ?')
    .bind(newsId)
    .first();

  if (!originalRow || !originalRow.entities) {
    return allArticles.slice(0, limit);
  }

  let originalEntities: {
    companies: string[];
    models: string[];
    technologies: string[];
    concepts: string[];
  };
  try {
    originalEntities = JSON.parse(String(originalRow.entities));
  } catch {
    return allArticles.slice(0, limit);
  }

  // Score articles by entity overlap
  const scored = allArticles.map((article) => {
    const articleEntities = article as unknown as {
      entities: typeof originalEntities | null;
    };
    if (!articleEntities.entities) {
      return { article, score: 0 };
    }

    const originalSet = new Set([
      ...originalEntities.companies,
      ...originalEntities.models,
      ...originalEntities.technologies,
      ...originalEntities.concepts,
    ]);

    const articleSet = new Set([
      ...articleEntities.entities.companies,
      ...articleEntities.entities.models,
      ...articleEntities.entities.technologies,
      ...articleEntities.entities.concepts,
    ]);

    // Calculate Jaccard similarity
    const intersection = new Set([...originalSet].filter((x) => articleSet.has(x)));
    const union = new Set([...originalSet, ...articleSet]);
    const score = union.size > 0 ? intersection.size / union.size : 0;

    return { article, score };
  });

  // Sort by score and return top results
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article);
}

// =============================================================================
// Role-based content
// =============================================================================

const ROLE_DATA: Record<UserRole, { title: string; description: string; topics: string[] }> = {
  developers: {
    title: 'AI for Developers',
    description:
      'Stay updated with the latest AI tools, frameworks, and best practices for software development.',
    topics: [
      'llm',
      'prompt-engineering',
      'rag',
      'langchain',
      'coding-assistants',
      'github-copilot',
    ],
  },
  'product-managers': {
    title: 'AI for Product Managers',
    description: 'Discover how AI is transforming product development and user experience.',
    topics: ['generative-ai', 'ai-adoption', 'enterprise-ai', 'copilot', 'ai-agents'],
  },
  designers: {
    title: 'AI for Designers',
    description: 'Explore AI tools for design, prototyping, and creative workflows.',
    topics: ['image-generation', 'midjourney', 'stable-diffusion', 'design-tools', 'creative-ai'],
  },
  'data-scientists': {
    title: 'AI for Data Scientists',
    description: 'Deep dives into ML models, research papers, and advanced AI techniques.',
    topics: ['machine-learning', 'deep-learning', 'reinforcement-learning', 'llm', 'transformer'],
  },
  executives: {
    title: 'AI for Executives',
    description: 'Strategic insights on AI adoption, industry trends, and business implications.',
    topics: ['enterprise-ai', 'ai-strategy', 'ai-regulation', 'industry-trends', 'mlops'],
  },
  entrepreneurs: {
    title: 'AI for Entrepreneurs',
    description: 'Build and scale AI-powered startups with the latest insights and opportunities.',
    topics: ['generative-ai', 'startup', 'funding', 'ai-adoption', 'product-development'],
  },
  researchers: {
    title: 'AI Research',
    description: 'Latest research papers, breakthroughs, and academic advancements in AI.',
    topics: ['llm', 'scaling-laws', 'emergent-abilities', 'safety', 'alignment', 'multimodal'],
  },
  students: {
    title: 'AI Learning for Students',
    description: 'Structured learning paths and resources to master AI concepts and skills.',
    topics: ['machine-learning', 'deep-learning', 'llm', 'python', 'pytorch', 'tensorflow'],
  },
};

export async function getRolePageData(role: UserRole): Promise<{
  role: UserRole;
  title: string;
  description: string;
  topics: TopicPage[];
  news: NewsListItem[];
}> {
  const roleConfig = ROLE_DATA[role];
  const db = await getDb();

  // Get topics related to this role
  const topicSlugs = roleConfig.topics.slice(0, 8);
  const placeholders = topicSlugs.map(() => '?').join(',');

  const topicRows = await db
    .prepare(`SELECT * FROM topic_pages WHERE slug IN (${placeholders}) AND is_active = 1`)
    .bind(...topicSlugs)
    .all();

  const topics = ((topicRows.results ?? []) as Record<string, unknown>[]).map(mapTopicRow);

  // Get relevant news for this role
  const topicPlaceholders = topics.map(() => '?').join(',');
  let news: NewsListItem[] = [];

  if (topics.length > 0) {
    const newsRows = await db
      .prepare(
        `
        SELECT DISTINCT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
        FROM news n
        JOIN sources s ON s.id = n.source_id
        JOIN topic_news tn ON n.id = tn.news_id
        WHERE tn.topic_id IN (${topicPlaceholders})
          AND n.importance >= 50
        ORDER BY n.published_at DESC
        LIMIT 12
        `
      )
      .bind(...topics.map((t) => t.id))
      .all();

    news = ((newsRows.results ?? []) as Record<string, unknown>[]).map(mapNewsRow).map(toListItem);
  } else {
    // Fallback: get recent high-quality news
    const newsRows = await db
      .prepare(
        `
        SELECT n.*, s.name AS source_name, s.type AS source_type, s.category AS source_category
        FROM news n
        JOIN sources s ON s.id = n.source_id
        WHERE n.importance >= 60
        ORDER BY n.published_at DESC
        LIMIT 12
        `
      )
      .all();

    news = ((newsRows.results ?? []) as Record<string, unknown>[]).map(mapNewsRow).map(toListItem);
  }

  return {
    role,
    title: roleConfig.title,
    description: roleConfig.description,
    topics,
    news,
  };
}

export function getRoleSlugs(): UserRole[] {
  return Object.keys(ROLE_DATA) as UserRole[];
}

export function isValidRole(role: string): role is UserRole {
  return role in ROLE_DATA;
}
