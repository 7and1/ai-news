/**
 * Test fixtures - sample data for testing
 */

import type { News } from '../db/types';

// Extended news item type for testing (includes more fields than NewsListItem)
type MockNewsItem = Omit<News, 'content' | 'updatedAt' | 'entities'>;

/**
 * Sample news articles for testing
 */
export const mockNewsItems: MockNewsItem[] = [
  {
    id: 'news-1',
    title: 'OpenAI Announces GPT-5 with Enhanced Reasoning',
    oneLine:
      'The latest model features significant improvements in reasoning and multimodal capabilities.',
    summary:
      'OpenAI has unveiled GPT-5, featuring advanced reasoning capabilities, improved multimodal understanding, and enhanced performance across benchmarks.',
    url: 'https://example.com/openai-gpt5',
    sourceId: 'openai-blog',
    sourceName: 'OpenAI Blog',
    sourceType: 'blog',
    sourceCategory: 'ai',
    category: 'Artificial_Intelligence',
    tags: ['openai', 'gpt-5', 'llm', 'reasoning'],
    importance: 85,
    sentiment: 'positive',
    language: 'en',
    ogImage: 'https://example.com/images/gpt5.jpg',
    publishedAt: 1704067200000, // 2024-01-01
    crawledAt: 1704070800000,
  },
  {
    id: 'news-2',
    title: "Google DeepMind's Gemini Ultra Sets New Records",
    oneLine: 'Gemini Ultra achieves state-of-the-art results on multiple benchmarks.',
    summary:
      "Google DeepMind's Gemini Ultra model has set new records on 30 out of 32 benchmarks, demonstrating exceptional capabilities in reasoning, coding, and multimodal tasks.",
    url: 'https://example.com/deepmind-gemini',
    sourceId: 'deepmind-blog',
    sourceName: 'DeepMind Blog',
    sourceType: 'blog',
    sourceCategory: 'ai',
    category: 'Artificial_Intelligence',
    tags: ['google', 'gemini', 'deepmind', 'multimodal'],
    importance: 80,
    sentiment: 'positive',
    language: 'en',
    ogImage: 'https://example.com/images/gemini.jpg',
    publishedAt: 1704153600000, // 2024-01-02
    crawledAt: 1704157200000,
  },
  {
    id: 'news-3',
    title: 'Anthropic Claude 3.5 Sonnet Released',
    oneLine: 'New model offers improved performance and lower latency.',
    summary:
      'Anthropic has released Claude 3.5 Sonnet, featuring improved performance on coding tasks, reduced latency, and enhanced safety features.',
    url: 'https://example.com/anthropic-claude',
    sourceId: 'anthropic-blog',
    sourceName: 'Anthropic Blog',
    sourceType: 'blog',
    sourceCategory: 'ai',
    category: 'Artificial_Intelligence',
    tags: ['anthropic', 'claude', 'llm', 'safety'],
    importance: 75,
    sentiment: 'positive',
    language: 'en',
    ogImage: 'https://example.com/images/claude.jpg',
    publishedAt: 1704240000000, // 2024-01-03
    crawledAt: 1704243600000,
  },
  {
    id: 'news-4',
    title: 'Meta Llama 3 Open Source Release',
    oneLine: 'Meta releases Llama 3 as open source for research.',
    summary:
      'Meta has released Llama 3, their largest open language model, available for research and commercial use under an open license.',
    url: 'https://example.com/meta-llama3',
    sourceId: 'meta-blog',
    sourceName: 'Meta AI Blog',
    sourceType: 'blog',
    sourceCategory: 'ai',
    category: 'Artificial_Intelligence',
    tags: ['meta', 'llama-3', 'open-source', 'llm'],
    importance: 78,
    sentiment: 'positive',
    language: 'en',
    ogImage: 'https://example.com/images/llama3.jpg',
    publishedAt: 1704326400000, // 2024-01-04
    crawledAt: 1704330000000,
  },
  {
    id: 'news-5',
    title: 'Microsoft Copilot Integration in Office',
    oneLine: 'AI-powered features now available across Office suite.',
    summary:
      'Microsoft has integrated Copilot AI assistant across all Office applications, bringing AI-powered writing, analysis, and creation capabilities to users.',
    url: 'https://example.com/microsoft-copilot',
    sourceId: 'microsoft-blog',
    sourceName: 'Microsoft Blog',
    sourceType: 'blog',
    sourceCategory: 'tech',
    category: 'Business_Tech',
    tags: ['microsoft', 'copilot', 'productivity', 'ai'],
    importance: 70,
    sentiment: 'neutral',
    language: 'en',
    ogImage: 'https://example.com/images/copilot.jpg',
    publishedAt: 1704412800000, // 2024-01-05
    crawledAt: 1704416400000,
  },
];

/**
 * Full news article with content
 */
export const mockNewsWithContent: News = {
  id: 'news-1',
  title: 'OpenAI Announces GPT-5 with Enhanced Reasoning',
  oneLine:
    'The latest model features significant improvements in reasoning and multimodal capabilities.',
  summary:
    'OpenAI has unveiled GPT-5, featuring advanced reasoning capabilities, improved multimodal understanding, and enhanced performance across benchmarks.',
  url: 'https://example.com/openai-gpt5',
  sourceId: 'openai-blog',
  sourceName: 'OpenAI Blog',
  sourceType: 'blog',
  sourceCategory: 'ai',
  category: 'Artificial_Intelligence',
  tags: ['openai', 'gpt-5', 'llm', 'reasoning'],
  importance: 85,
  sentiment: 'positive',
  language: 'en',
  ogImage: 'https://example.com/images/gpt5.jpg',
  publishedAt: 1704067200000,
  crawledAt: 1704070800000,
  content: `
    <p>OpenAI has officially announced GPT-5, the latest iteration of their groundbreaking language model series.</p>
    <p>The new model features significant improvements in several key areas:</p>
    <ul>
      <li>Enhanced reasoning capabilities</li>
      <li>Better multimodal understanding</li>
      <li>Improved coding performance</li>
      <li>Reduced latency for faster responses</li>
    </ul>
    <p>GPT-5 scores 96.4% on MMLU, up from 86.4% in GPT-4.</p>
  `,
  updatedAt: 1704070800000,
  entities: {
    companies: ['OpenAI'],
    models: ['GPT-5'],
    technologies: ['language model', 'multimodal'],
    concepts: ['reasoning', 'MMLU'],
  },
};

/**
 * Sample database rows for testing
 */
export const mockDbRows = {
  news: [
    {
      id: 'news-1',
      title: 'OpenAI Announces GPT-5',
      summary: 'Latest AI model announcement',
      one_line: 'GPT-5 features enhanced reasoning',
      content: '<p>Article content here</p>',
      url: 'https://example.com/openai-gpt5',
      source_id: 'openai-blog',
      category: 'Artificial_Intelligence',
      tags: JSON.stringify(['openai', 'gpt-5', 'llm']),
      importance: 85,
      sentiment: 'positive',
      language: 'en',
      og_image: 'https://example.com/images/gpt5.jpg',
      published_at: 1704067200000,
      crawled_at: 1704070800000,
      source_name: 'OpenAI Blog',
      source_type: 'blog',
      source_category: 'ai',
    },
  ],
  sources: [
    {
      id: 'openai-blog',
      name: 'OpenAI Blog',
      url: 'https://openai.com/blog',
      type: 'blog',
      category: 'ai',
      language: 'en',
      is_active: 1,
      crawl_frequency: 3600,
      last_crawled_at: 1704070800000,
      error_count: 0,
    },
  ],
};

/**
 * Sample newsletter subscriber data
 */
export const mockSubscriber = {
  id: 'sub-1',
  email: 'test@example.com',
  confirmed: true,
  confirmationToken: 'token-abc123',
  unsubscribeToken: 'unsub-xyz789',
  preferences: {
    categories: ['Artificial_Intelligence', 'Business_Tech'],
    frequency: 'weekly',
    language: 'en',
  },
  subscribedAt: 1704067200000,
  confirmedAt: 1704070800000,
  unsubscribedAt: null,
};

/**
 * Sample search analytics data
 */
export const mockSearchAnalytics = {
  queries: [
    { query: 'GPT-5', count: 150 },
    { query: 'Claude', count: 120 },
    { query: 'Gemini', count: 95 },
    { query: 'Llama 3', count: 80 },
    { query: 'open source', count: 65 },
  ],
  trending: [
    { query: 'GPT-5', count: 150, delta: 45 },
    { query: 'Claude 3.5', count: 85, delta: 30 },
    { query: 'Gemini Ultra', count: 60, delta: 25 },
  ],
  zeroResults: [{ query: 'nonexistent topic', count: 15, lastSeen: 1704067200000 }],
};

/**
 * Sample error entries
 */
export const mockErrors = [
  {
    id: 'fp_abc123',
    timestamp: 1704067200000,
    message: 'Database connection timeout',
    name: 'DatabaseError',
    fingerprint: 'fp_abc123',
    resolved: false,
    count: 5,
    firstSeen: 1704067200000,
    lastSeen: 1704153600000,
    context: {
      path: '/api/news',
      method: 'GET',
    },
  },
];

/**
 * Sample metrics
 */
export const mockMetrics = {
  counters: [
    {
      type: 'counter',
      name: 'http_requests_total',
      description: 'Total HTTP requests',
      values: [
        {
          value: 1,
          timestamp: 1704067200000,
          labels: { method: 'GET', path: '/api/news', status: '2xx' },
        },
        {
          value: 1,
          timestamp: 1704067260000,
          labels: { method: 'GET', path: '/api/news', status: '2xx' },
        },
      ],
    },
  ],
  gauges: [
    {
      type: 'gauge',
      name: 'active_connections',
      description: 'Active database connections',
      value: 15,
      timestamp: 1704067200000,
    },
  ],
  histograms: [
    {
      type: 'histogram',
      name: 'request_duration_ms',
      description: 'Request duration in milliseconds',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500],
      counts: {
        '1': 0,
        '5': 2,
        '10': 8,
        '25': 15,
        '50': 20,
        '100': 25,
        '250': 28,
        '500': 30,
      },
      sum: 4500,
      count: 30,
      min: 3,
      max: 480,
    },
  ],
};

/**
 * Sample API responses
 */
export const mockApiResponses = {
  newsList: {
    items: mockNewsItems,
    nextCursor: 'eyJwdWJsaXNoZWRBdCI6MTcwNDMyNjQwMDAwMCwiaWQiOiJuZXdzLTUifQ',
  },
  searchResults: {
    items: mockNewsItems.slice(0, 3),
    nextCursor: null,
    total: 3,
    queryInfo: {
      query: 'GPT-5',
      parsedQuery: '"GPT-5"',
      filters: [],
      hasAdvancedSyntax: true,
    },
  },
  subscribeSuccess: {
    success: true,
    message: 'Please check your email to confirm your subscription',
    confirmed: false,
  },
  subscribeAlreadyConfirmed: {
    success: true,
    message: 'Already subscribed',
    confirmed: true,
  },
};

/**
 * Helper to create a mock Request object
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Request {
  const { method = 'GET', headers = {}, body } = options;

  const headersObj = new Headers(headers);
  let requestBody: string | undefined;

  if (body) {
    requestBody = JSON.stringify(body);
    headersObj.set('Content-Type', 'application/json');
  }

  return new Request(url, {
    method,
    headers: headersObj,
    body: requestBody,
  });
}

/**
 * Helper to create mock search params
 */
export function createMockSearchParams(params: Record<string, string | string[]>): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, v));
    } else {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}

/**
 * Wait for async operations in tests
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock NextRequest with additional properties
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): {
  url: URL;
  nextUrl: URL;
  headers: Headers;
  method: string;
  json: () => Promise<unknown>;
} {
  const { method = 'GET', headers = {}, body } = options;

  const headersObj = new Headers(headers);
  let requestBody: string | undefined;

  if (body) {
    requestBody = JSON.stringify(body);
    headersObj.set('Content-Type', 'application/json');
  }

  const urlObj = new URL(url);

  return {
    url: urlObj,
    nextUrl: urlObj,
    headers: headersObj,
    method,
    async json() {
      if (!requestBody) {
        throw new Error('No body');
      }
      return JSON.parse(requestBody);
    },
  };
}
