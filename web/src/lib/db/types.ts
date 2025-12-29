export type SourceType = 'blog' | 'twitter' | 'newsletter' | 'wechat' | 'news';
export type SourceCategory = 'ai_company' | 'ai_media' | 'ai_kol' | 'ai_tool' | string;
export type Language = 'en' | 'zh' | string;

export type Source = {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  category: SourceCategory | null;
  language: Language | null;
};

export type News = {
  id: string;
  title: string;
  summary: string | null;
  oneLine: string | null;
  content: string | null;
  url: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  sourceCategory: SourceCategory | null;
  category: string | null;
  tags: string[];
  importance: number;
  sentiment: string | null;
  language: Language;
  ogImage: string | null;
  publishedAt: number;
  crawledAt: number;
  updatedAt: number;
  entities: NewsEntities | null;
};

export type NewsEntities = {
  companies: string[];
  models: string[];
  technologies: string[];
  concepts: string[];
};

export type NewsListItem = Pick<
  News,
  | 'id'
  | 'title'
  | 'summary'
  | 'oneLine'
  | 'url'
  | 'sourceName'
  | 'sourceType'
  | 'sourceCategory'
  | 'category'
  | 'tags'
  | 'importance'
  | 'language'
  | 'publishedAt'
  | 'updatedAt'
>;

// =============================================================================
// pSEO Types
// =============================================================================

export type TopicType = 'model' | 'technology' | 'concept' | 'company';

export type TopicPage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: TopicType;
  parentTopicId: string | null;
  aliases: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  contentHtml: string | null;
  newsCount: number;
  lastNewsUpdatedAt: number | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  // Joined fields
  children?: TopicPage[];
  recentNews?: NewsListItem[];
};

export type Company = {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  foundedYear: number | null;
  headquarters: string | null;
  website: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  contentHtml: string | null;
  newsCount: number;
  lastNewsUpdatedAt: number | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  // Joined fields
  recentNews?: NewsListItem[];
};

export type LearningPath = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  estimatedHours: number | null;
  topics: string[];
  prerequisites: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  contentHtml: string | null;
  enrollmentCount: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  // Joined fields
  relatedTopics?: TopicPage[];
};

export type ComparisonPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  comparisonType: string | null;
  entityAType: string | null;
  entityAId: string | null;
  entityBType: string | null;
  entityBId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  contentHtml: string | null;
  viewCount: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

// Role-based page types
export type UserRole =
  | 'developers'
  | 'product-managers'
  | 'designers'
  | 'data-scientists'
  | 'executives'
  | 'entrepreneurs'
  | 'researchers'
  | 'students';

export type RolePageData = {
  role: UserRole;
  title: string;
  description: string;
  recommendedTopics: string[];
  recommendedPaths: string[];
};

export type TopicNewsItem = {
  topicId: string;
  newsId: string;
  relevanceScore: number;
  createdAt: number;
  // Joined fields
  news?: NewsListItem;
  topic?: TopicPage;
};

export type CompanyNewsItem = {
  companyId: string;
  newsId: string;
  relevanceScore: number;
  createdAt: number;
  // Joined fields
  news?: NewsListItem;
  company?: Company;
};

// Breadcrumb item type
export type BreadcrumbItem = {
  name: string;
  href: string;
  current?: boolean;
};

// SEO metadata types
export type SeoMetadata = {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  canonicalUrl?: string;
};
