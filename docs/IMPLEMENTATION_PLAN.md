# AI News 项目实施方案

> 版本: v1.0
> 更新时间: 2025-12-29
> 目标: ROI 最大化、SEO 友好、零运维

---

## 一、核心架构

### 1.1 技术栈总览

| 维度         | 方案选择                          | 理由                                                                  |
| ------------ | --------------------------------- | --------------------------------------------------------------------- |
| **前端框架** | Next.js 15 (App Router)           | SEO 标杆，支持 **Partial Prerendering (PPR)**，兼顾静态速度与动态交互 |
| **部署平台** | Cloudflare Workers (via OpenNext) | 2025 官方推荐路径，支持完整 Node.js 运行时、ISR 和图像优化            |
| **数据层**   | Cloudflare D1 (SQLite)            | 边缘数据库，低延迟，$5 计划内几乎免费                                 |
| **资产存储** | Cloudflare R2                     | ��放图片/OG 预览图，规避防盗链风险                                    |
| **UI 组件**  | Tailwind CSS + Shadcn UI          | 配合 Claude Code "Vibe Coding" 最佳组合                               |
| **AI 处理**  | Claude API / Gemini 1.5 Flash     | 高质量内容分析，成本可控                                              |
| **爬虫层**   | Jina Reader API                   | 免费 200 RPM，覆盖微信公众号                                          |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户访问层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   浏览器      │  │   RSS阅读器   │  │   搜索引擎    │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js 15 (OpenNext)                                   │    │
│  │  ├─ ISR / PPR                                            │    │
│  │  ├─ Dynamic Sitemap                                      │    │
│  │  ├─ JSON-LD 结构化数据                                   │    │
│  │  └─ OG Image 生成 (@vercel/og)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                         │                            │
│  ┌──────▼──────────┐      ┌───────▼──────────┐                 │
│  │  Cloudflare D1  │      │  Cloudflare R2   │                 │
│  │  (新闻数据)      │      │  (图片/OG图)     │                 │
│  └─────────────────┘      └──────────────────┘                 │
└─────────┬────────────────────────────────────────────────────────┘
          │
          │ Webhook (数据更新通知)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker 服务器 (32G RAM)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  RSS Crawler + AI Processing Pipeline                   │    │
│  │  ├─ RSS Parser (330 源)                                │    │
│  │  ├─ Jina Reader API (微信全文抓取)                     │    │
│  │  ├─ AI 分析 (Claude/Gemini)                             │    │
│  │  ├─ 去重/聚类                                           │    │
│  │  └─ D1 API 推送                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  定时任务 (Cron)                                        │    │
│  │  ├─ 高频源 (Twitter): 每 30 分钟                        │    │
│  │  ├─ 中频源 (Blog): 每 3 小时                            │    │
│  │  └─ 低频源 (微信): 每 6 小时                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、数据源规划

### 2.1 精选源配置 (80个 MVP 源)

基于 BestBlogs 330 核心源分析，精选如下：

#### Tier 1: AI 公司官方 (20个)

| 类型    | 名称            | RSS URL                                      | 频率 | Crawl |
| ------- | --------------- | -------------------------------------------- | ---- | ----- |
| Blog    | OpenAI Blog     | https://openai.com/news/rss.xml              | 周   | ❌    |
| Blog    | Anthropic News  | https://rsshub.bestblogs.dev/anthropic/news  | 周   | ✅    |
| Blog    | Hugging Face    | https://huggingface.co/blog/feed.xml         | 周   | ❌    |
| Blog    | Google DeepMind | https://deepmind.com/blog/feed/basic/        | 周   | ❌    |
| Blog    | Google AI       | https://blog.google/rss                      | 周   | ❌    |
| Blog    | AI at Meta      | https://rsshub.app/meta/ai/blog              | 周   | ✅    |
| Blog    | LangChain       | https://blog.langchain.dev/rss/              | 周   | ❌    |
| Blog    | LlamaIndex      | https://www.llamaindex.ai/blog/feed          | 周   | ❌    |
| Blog    | AWS ML          | https://aws.amazon.com/blogs/amazon-ai/feed/ | 周   | ❌    |
| Blog    | Databricks      | https://www.databricks.com/feed              | 周   | ❌    |
| 微信    | 智谱            | wechat2rss                                   | 日   | ✅    |
| 微信    | 月之暗面 Kimi   | wechat2rss                                   | 日   | ✅    |
| 微信    | DeepSeek        | wechat2rss                                   | 日   | ✅    |
| 微信    | 通义大模型      | wechat2rss                                   | 日   | ✅    |
| 微信    | 腾讯混元        | wechat2rss                                   | 日   | ✅    |
| 微信    | 阶跃星辰        | wechat2rss                                   | 日   | ✅    |
| 微信    | MiniMax         | wechat2rss                                   | 日   | ✅    |
| 微信    | Dify            | wechat2rss                                   | 周   | ✅    |
| Twitter | @OpenAI         | xgo RSS                                      | 日   | ❌    |
| Twitter | @AnthropicAI    | xgo RSS                                      | 日   | ❌    |

#### Tier 2: AI 媒体/资讯 (15个)

| 类型       | 名称             | 频率 | Crawl |
| ---------- | ---------------- | ---- | ----- |
| 微信       | 量子位           | 日   | ✅    |
| 微信       | 机器之心         | 日   | ✅    |
| 微信       | 新智元           | 日   | ✅    |
| 微信       | AI前线           | 日   | ✅    |
| 微信       | 智东西           | 日   | ✅    |
| 微信       | AI科技评论       | 日   | ✅    |
| 微信       | 夕小瑶科技说     | 日   | ✅    |
| Newsletter | Last Week in AI  | 周   | ❌    |
| Newsletter | Latent Space     | 周   | ❌    |
| Newsletter | AI Musings by Mu | 周   | ❌    |
| Twitter    | @TheRundownAI    | 日   | ❌    |
| Twitter    | @rowancheung     | 日   | ❌    |
| Twitter    | @AiBreakfast     | 日   | ❌    |
| Twitter    | @simonw          | 日   | ❌    |
| Blog       | Simon Willison   | 周   | ❌    |

#### Tier 3: AI 研究/KOL (25个)

| Twitter Handle  | 频率 | 类型   |
| --------------- | ---- | ------ |
| @karpathy       | 周   | 研究者 |
| @ylecun         | 周   | 研究者 |
| @AndrewYNg      | 周   | 教育   |
| @drfeifei       | 周   | 研究者 |
| @GoogleDeepMind | 周   | 官方   |
| @DeepLearningAI | 周   | 教育   |
| @StanfordAILab  | 周   | 实验室 |
| @berkeley_ai    | 周   | 实验室 |
| @NVIDIAAI       | 周   | 官方   |
| @dotey (宝玉)   | 日   | KOL    |
| @op7418 (歸藏)  | 日   | KOL    |
| @perplexity_ai  | 周   | 产品   |
| @cursor_ai      | 周   | 产品   |
| @v0             | 周   | 产品   |
| @boltdotnew     | 周   | 产品   |
| @midjourney     | 周   | 产品   |
| @runwayml       | 周   | 产品   |
| @elevenlabsio   | 周   | 产品   |
| @a16z           | 周   | VC     |
| @ycombinator    | 周   | VC     |
| @paulg          | 周   | VC     |
| @naval          | 月   | 投资   |
| @lennysan       | 周   | 产品   |
| @venturetwins   | 周   | VC     |
| @rauchg         | 周   | 技术   |

#### Tier 4: AI 工具/基础设施 (20个)

| 类型    | 名称             | 频率 | Crawl |
| ------- | ---------------- | ---- | ----- |
| Blog    | Qdrant           | 周   | ❌    |
| Blog    | Groq             | 周   | ❓    |
| 微信    | ShowMeAI研究中心 | 周   | ✅    |
| 微信    | 歸藏的AI工具箱   | 日   | ✅    |
| 微信    | AI产品黄叔       | 日   | ✅    |
| 微信    | 数字生命卡兹克   | 日   | ✅    |
| 微信    | 青哥谈AI         | 日   | ✅    |
| 微信    | Datawhale        | 周   | ✅    |
| Blog    | 宝玉的分享       | 周   | ❌    |
| Twitter | @LangChainAI     | 周   | ❌    |
| Twitter | @llama_index     | 周   | ❌    |
| Twitter | @dify_ai         | 周   | ❌    |
| Twitter | @ollama          | 周   | ❌    |
| Twitter | @huggingface     | 周   | ❌    |
| Twitter | @firecrawl_dev   | 周   | ❌    |
| Twitter | @Replit          | 周   | ❌    |
| Twitter | @NotionHQ        | 周   | ❌    |
| Twitter | @NotebookLM      | 周   | ❌    |
| Twitter | @windsurf_ai     | 周   | ❌    |
| Twitter | @browser_use     | 周   | ❌    |

### 2.2 抓取策略

```
┌─────────────────────────────────────────────────────────────┐
│  抓取频率分级                                               │
├─────────────────────────────────────────────────────────────┤
│  高频 (每 30 分钟): Twitter 源 (20 个核心账号)              │
│  中频 (每 3 小时):  官方博客 + Newsletter (40 个)           │
│  低频 (每 6 小时):  微信公众号 + 媒体 (20 个)               │
├─────────────────────────────────────────────────────────────┤
│  预计日新增: 150-200 条 AI 相关新闻/快讯                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据库设计

### 3.1 D1 表结构

```sql
-- 文章表
CREATE TABLE news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,              -- AI 生成的摘要
  one_line TEXT,             -- 一句话快讯
  content TEXT,              -- 全文内容 (可选)
  url TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,   -- 外键
  category TEXT,             -- AI 分类
  tags TEXT,                 -- JSON 数组: ["GPT-5", "模型"]
  importance INTEGER DEFAULT 50, -- 0-100 重要性
  sentiment TEXT,            -- positive/neutral/negative
  language TEXT DEFAULT 'en',-- en/zh
  published_at INTEGER NOT NULL,
  crawled_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_news_published ON news(published_at DESC);
CREATE INDEX idx_news_importance ON news(importance DESC);
CREATE INDEX idx_news_category ON news(category);
CREATE INDEX idx_news_source ON news(source_id);

-- 订阅源表
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,         -- blog/twitter/newsletter/wechat
  category TEXT,              -- ai_company/ai_media/ai_kol/ai_tool
  language TEXT,              -- en/zh
  crawl_frequency INTEGER DEFAULT 3600, -- 秒
  need_crawl BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  last_crawled_at INTEGER,
  last_success_at INTEGER,
  error_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 热点聚类表 (同一事件的聚合)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  news_ids TEXT,              -- JSON 数组: ["id1", "id2"]
  companies TEXT,             -- JSON: ["OpenAI", "Google"]
  models TEXT,                -- JSON: ["GPT-5", "Claude 4"]
  importance INTEGER DEFAULT 50,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 快讯表 (Twitter 推文专用)
CREATE TABLE tweets (
  id TEXT PRIMARY ID,
  news_id TEXT,               -- 关联 news (如果有链接文章)
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  posted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (news_id) REFERENCES news(id)
);

-- 统计/缓存表
CREATE TABLE stats (
  date TEXT PRIMARY KEY,      -- YYYY-MM-DD
  news_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  crawl_success INTEGER DEFAULT 0,
  crawl_error INTEGER DEFAULT 0
);
```

### 3.2 初始数据

```sql
-- 插入核心订阅源
INSERT INTO sources (id, name, url, type, category, language, crawl_frequency, need_crawl) VALUES
-- AI 公司官方
('openai-blog', 'OpenAI Blog', 'https://openai.com/news/rss.xml', 'blog', 'ai_company', 'en', 10800, 0),
('anthropic-news', 'Anthropic News', 'https://rsshub.bestblogs.dev/anthropic/news', 'blog', 'ai_company', 'en', 10800, 1),
('huggingface-blog', 'Hugging Face Blog', 'https://huggingface.co/blog/feed.xml', 'blog', 'ai_company', 'en', 10800, 0),
('deepmind-blog', 'Google DeepMind Blog', 'https://deepmind.com/blog/feed/basic/', 'blog', 'ai_company', 'en', 10800, 0),
-- AI 媒体
('qbitai', '量子位', 'https://www.qbitai.com/feed', 'news', 'ai_media', 'zh', 7200, 1),
('jiqizhixin', '机器之心', 'https://wechat2rss.bestblogs.dev/feed/8d97af31b0de9e48da74558af128a4673d78c9a3.xml', 'wechat', 'ai_media', 'zh', 7200, 1),
('xinzhiyuan', '新智元', 'https://wechat2rss.bestblogs.dev/feed/e531a18b21c34cf787b83ab444eef659d7a980de.xml', 'wechat', 'ai_media', 'zh', 7200, 1),
-- Twitter (核心)
('twitter-openai', 'OpenAI', 'https://api.xgo.ing/rss/user/0c0856a69f9f49cf961018c32a0b0049', 'twitter', 'ai_company', 'en', 1800, 0),
('twitter-karpathy', 'Andrej Karpathy', 'https://api.xgo.ing/rss/user/edf707b5c0b248579085f66d7a3c5524', 'twitter', 'ai_kol', 'en', 1800, 0),
('twitter-dotey', '宝玉', 'https://api.xgo.ing/rss/user/97f1484ae48c430fbbf3438099743674', 'twitter', 'ai_kol', 'zh', 1800, 0);
```

---

## 四、SEO 优化方案

### 4.1 结构化数据 (JSON-LD)

```typescript
// src/lib/seo.ts
import { NewsArticle, WebSite } from "schema-dts";

export function generateNewsArticleJsonLd(news: News) {
  const jsonLd: NewsArticle = {
    "@type": "NewsArticle",
    headline: news.title,
    description: news.summary,
    image: news.og_image,
    datePublished: new Date(news.published_at).toISOString(),
    dateModified: new Date(news.updated_at).toISOString(),
    author: {
      "@type": "Organization",
      name: news.source_name,
    },
    publisher: {
      "@type": "Organization",
      name: "AI News",
      logo: {
        "@type": "ImageObject",
        url: "https://ai-news.com/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://ai-news.com/news/${news.id}`,
    },
    articleSection: news.category,
    keywords: news.tags?.join(", "),
    inLanguage: news.language === "zh" ? "zh-CN" : "en-US",
  };

  return JSON.stringify(jsonLd);
}

export function generateWebSiteJsonLd() {
  const jsonLd: WebSite = {
    "@type": "WebSite",
    name: "AI News",
    url: "https://ai-news.com",
    description:
      "每日 AI 行业快讯，聚合 OpenAI、Anthropic、Google DeepMind 等顶级 AI 公司动态",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://ai-news.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return JSON.stringify(jsonLd);
}
```

### 4.2 动态 Sitemap

```typescript
// src/app/sitemap.ts
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://ai-news.com";

  // 从 D1 获取所有新闻
  const news = await db`
    SELECT id, updated_at FROM news
    WHERE importance >= 50
    ORDER BY published_at DESC
    LIMIT 50000
  `;

  const newsUrls = news.map((item) => ({
    url: `${baseUrl}/news/${item.id}`,
    lastModified: new Date(item.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/latest`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...newsUrls,
  ];
}
```

### 4.3 Robots.txt

```typescript
// src/app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: "https://ai-news.com/sitemap.xml",
  };
}
```

### 4.4 Meta Tags 模板

```typescript
// src/lib/metadata.ts
export function generateNewsMetadata(news: News) {
  return {
    title: `${news.title} | AI News`,
    description: news.one_line || news.summary,
    openGraph: {
      title: news.title,
      description: news.one_line || news.summary,
      url: `https://ai-news.com/news/${news.id}`,
      siteName: "AI News",
      locale: news.language === "zh" ? "zh_CN" : "en_US",
      type: "article",
      publishedTime: news.published_at,
      modifiedTime: news.updated_at,
      authors: [news.source_name],
      images: [
        {
          url: news.og_image || `https://ai-news.com/og/${news.id}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: news.title,
      description: news.one_line || news.summary,
      images: [news.og_image || `https://ai-news.com/og/${news.id}`],
    },
    alternates: {
      canonical: `https://ai-news.com/news/${news.id}`,
    },
  };
}
```

---

## 五、项目结构

```
/ai-news
├── docker/                          # Docker 服务器代码
│   ├── crawler/
│   │   ├── index.ts                 # RSS 爬虫入口
│   │   ├── parsers/
│   │   │   ├── rss.ts               # RSS 解析器
│   │   │   ├── twitter.ts           # Twitter 解析器
│   │   │   └── wechat.ts            # 微信解析器
│   │   ├── processors/
│   │   │   ├── jina.ts              # Jina Reader API
│   │   │   ├── ai-analyzer.ts       # AI 内容分析
│   │   │   └── dedupe.ts            # 去重逻辑
│   │   └── config.ts                # 源配置
│   ├── scheduler/
│   │   └── cron.ts                  # 定时任务调度
│   └── Dockerfile
│
├── web/                             # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── (main)/
│   │   │   │   ├── page.tsx         # 首页 (瀑布流)
│   │   │   │   ├── latest/
│   │   │   │   │   └── page.tsx     # 最新快讯
│   │   │   │   ├── companies/
│   │   │   │   │   └── page.tsx     # 公司动态
│   │   │   │   └── layout.tsx
│   │   │   ├── news/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # 新闻详情
│   │   │   ├── api/
│   │   │   │   ├── revalidate/
│   │   │   │   │   └── route.ts     # Webhook 接收
│   │   │   │   └── news/
│   │   │   │       └── route.ts     # 新闻 API
│   │   │   ├── sitemap.ts
│   │   │   ├── robots.ts
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── news/
│   │   │   │   ├── NewsCard.tsx     # 新闻卡片
│   │   │   │   ├── NewsGrid.tsx     # 瀑布流
│   │   │   │   ├── TweetCard.tsx    # 推文卡片
│   │   │   │   └── EventCluster.tsx # 事件聚类
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── ui/                  # Shadcn UI 组件
│   │   ├── lib/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts        # 数据库 Schema
│   │   │   │   └── queries.ts       # SQL 查询
│   │   │   ├── d1.ts                # Cloudflare D1 客户端
│   │   │   ├── seo.ts               # SEO 工具
│   │   │   └── utils.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── wrangler.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── docs/
│   ├── RSS_SOURCES_ANALYSIS.md      # 源分析
│   ├── IMPLEMENTATION_PLAN.md       # 本文件
│   └── API_DOCS.md                  # API 文档
│
└── README.md
```

---

## 六、关键配置

### 6.1 wrangler.json

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ai-news",
  "compatibility_date": "2025-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": ".open-next/index.js",
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ai_news_db",
      "database_id": "your-database-id"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "ai-news-images"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "your-kv-id"
    }
  ],
  "env": {
    "production": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "ai_news_db",
          "database_id": "your-production-database-id"
        }
      ]
    }
  }
}
```

### 6.2 next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // 启用 Partial Prerendering (PPR)
  experimental: {
    ppr: "incremental",
  },

  // 图片优化 (使用 Cloudflare Images)
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  // Headers (CORS/Security)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 6.3 package.json (web/)

```json
{
  "name": "ai-news-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "wrangler": "wrangler",
    "deploy": "npm run build && wrangler deploy",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "date-fns": "^4.1.0",
    "schema-dts": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.6",
    "@types/react-dom": "^19.0.2",
    "typescript": "^5.7.2",
    "tailwindcss": "^3.4.17",
    "wrangler": "^3.94.0"
  }
}
```

---

## 七、数据流实现

### 7.1 Docker 端: 爬虫 + AI 分析

```typescript
// docker/crawler/index.ts
import Parser from "rss-parser";
import { D1Database } from "@cloudflare/workers-types";

const JINA_API = "https://r.jina.ai/http://";

interface Source {
  id: string;
  name: string;
  url: string;
  type: "blog" | "twitter" | "wechat" | "newsletter";
  need_crawl: boolean;
}

export class NewsCrawler {
  private parser: Parser;
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.parser = new Parser();
    this.d1 = d1;
  }

  async crawlSource(source: Source) {
    const feed = await this.parser.parseURL(source.url);

    for (const item of feed.items.slice(0, 20)) {
      // 1. 去重检查
      const exists = await this.checkExists(item.link!);
      if (exists) continue;

      // 2. 获取全文 (如需要)
      let content = item.contentSnippet || item.content;
      if (source.need_crawl) {
        content = await this.fetchFullContent(item.link!);
      }

      // 3. AI 分析
      const analysis = await this.analyzeWithAI({
        title: item.title!,
        content: content,
        url: item.link!,
        source: source.name,
      });

      // 4. 存入 D1
      await this.saveToD1({
        id: this.generateId(item.link!),
        title: item.title!,
        summary: analysis.summary,
        one_line: analysis.oneLine,
        content: content,
        url: item.link!,
        source_id: source.id,
        category: analysis.category,
        tags: JSON.stringify(analysis.tags),
        importance: analysis.importance,
        language: analysis.language,
        published_at: new Date(item.pubDate!).getTime(),
      });
    }
  }

  async fetchFullContent(url: string): Promise<string> {
    const response = await fetch(`${JINA_API}${encodeURIComponent(url)}`);
    return await response.text();
  }

  async analyzeWithAI(data: {
    title: string;
    content: string;
    url: string;
    source: string;
  }) {
    // 调用 Claude API 或 Gemini API
    // 返回: { summary, oneLine, category, tags, importance, language }
  }

  async checkExists(url: string): Promise<boolean> {
    const result = await this.d1
      .prepare("SELECT 1 FROM news WHERE url = ? LIMIT 1")
      .bind(url)
      .first();
    return !!result;
  }

  async saveToD1(news: Record<string, any>) {
    await this.d1
      .prepare(
        `
        INSERT INTO news (id, title, summary, one_line, content, url, source_id,
                         category, tags, importance, language, published_at,
                         crawled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        news.id,
        news.title,
        news.summary,
        news.one_line,
        news.content,
        news.url,
        news.source_id,
        news.category,
        news.tags,
        news.importance,
        news.language,
        news.published_at,
        Date.now(),
      )
      .run();
  }

  generateId(url: string): string {
    // 简单的 hash 生成
    return Buffer.from(url).toString("base64").slice(0, 16);
  }
}
```

### 7.2 Cloudflare 端: ISR + Revalidation

```typescript
// web/src/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");

  // 验证密钥
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, id } = body;

  try {
    if (type === "news") {
      // 重新验证新闻详情页
      revalidatePath(`/news/${id}`);
      // 重新验证首页
      revalidatePath("/");
      revalidatePath("/latest");
    } else if (type === "batch") {
      // 批量重新验证
      revalidatePath("/");
      revalidatePath("/latest");
    }

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ error: "Error revalidating" }, { status: 500 });
  }
}
```

### 7.3 新闻详情页 (ISR)

```typescript
// web/src/app/news/[id]/page.tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/queries';
import { generateNewsArticleJsonLd, generateNewsMetadata } from '@/lib/seo';
import { NewsCard } from '@/components/news/NewsCard';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const news = await db.getNewsById(params.id);
  if (!news) return {};
  return generateNewsMetadata(news);
}

export const revalidate = 3600; // ISR: 1 小时

export default async function NewsPage({ params }: Props) {
  const news = await db.getNewsById(params.id);

  if (!news) {
    notFound();
  }

  const jsonLd = generateNewsArticleJsonLd(news);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <article className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">{news.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
          <span>{news.source_name}</span>
          <span>•</span>
          <time>{new Date(news.published_at).toLocaleString()}</time>
          <span>•</span>
          <span>重要度: {news.importance}/100</span>
        </div>
        <div className="prose prose-lg max-w-none">
          {news.summary && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <strong>摘要：</strong> {news.summary}
            </div>
          )}
          {news.content && (
            <div dangerouslySetInnerHTML={{ __html: news.content }} />
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {news.tags?.map((tag: string) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm"
            >
              #{tag}
            </span>
          ))}
        </div>
      </article>
    </>
  );
}
```

---

## 八、成本预算

### 8.1 月度成本明细

| 项目     | 服务                    | 用量        | 单价    | 月费           |
| -------- | ----------------------- | ----------- | ------- | -------------- |
| 托管     | Cloudflare Workers Paid | 100万请求   | $5/mo   | $5             |
| 数据库   | D1 (包含在 Workers)     | 5GB 存储    | $0      | $0             |
| 存储     | R2 (包含在 Workers)     | 10GB        | $0      | $0             |
| 缓存     | KV (包含在 Workers)     | 1GB         | $0      | $0             |
| 域名     | .com                    | 1年         | $10/年  | ~$1            |
| AI API   | Claude 3.5 Haiku        | 500k tokens | $0.25/M | ~$2-5          |
| 爬虫     | Jina Reader             | 5000请求    | $0      | $0             |
| **总计** |                         |             |         | **~$10-15/月** |

### 8.2 扩展空间

```
当前配置支持:
├── 日活用户: 10,000+
├── 月浏览量: 300,000+
├── 日增新闻: 200+
└── 总新闻量: 100,000+
```

---

## 九、开发路线图

### Phase 1: MVP (2周)

- [ ] 初始化 Next.js 项目 + Cloudflare 配置
- [ ] D1 数据库表创建
- [ ] 基础爬虫 (20个核心源)
- [ ] AI 分析集成 (摘要/分类/标签)
- [ ] 首页 + 详情页 UI
- [ ] SEO 基础 (sitemap/robots/json-ld)

### Phase 2: 核心 (2周)

- [ ] 完整爬虫 (80个源)
- [ ] Twitter 推文集成
- [ ] ISR + Revalidation
- [ ] 搜索功能
- [ ] 分类/标签页面
- [ ] Newsletter 订阅

### Phase 3: 增强 (2周)

- [ ] 事件聚类
- [ ] 重要性排序算法
- [ ] OG Image 自动生成
- [ ] 用户收藏/阅读历史
- [ ] API 开放

### Phase 4: 优化 (持续)

- [ ] 性能优化
- [ ] 移动端优化
- [ ] PWA 支持
- [ ] 多语言切换

---

## 十、快速启动

### 10.1 环境准备

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 创建 D1 数据库
wrangler d1 create ai_news_db

# 4. 创建 R2 Bucket
wrangler r2 bucket create ai-news-images

# 5. 初始化 Next.js 项目
cd web
npm create next-app@latest . --typescript --tailwind --app
npm install @cloudflare/workers-types wrangler

# 6. 配置 OpenNext
npm install @opennext/cloudflare
npx @opennext/cloudflare build
```

### 10.2 数据库初始化

```bash
# 执行 SQL
wrangler d1 execute ai_news_db --file=./src/lib/db/schema.sql

# 插入初始数据
wrangler d1 execute ai_news_db --file=./src/lib/db/seed.sql
```

### 10.3 启动开发

```bash
# 本地开发 (使用 wrangler)
npm run dev

# 部署到 Cloudflare
npm run deploy
```

---

## 十一、监控与维护

### 11.1 关键指标

| 指标         | 目标         | 监控方式                 |
| ------------ | ------------ | ------------------------ |
| 爬取成功率   | >95%         | Cloudflare Analytics     |
| 页面加载速度 | <2s          | PageSpeed Insights       |
| SEO 收录率   | >80%         | Google Search Console    |
| 日活用户     | 增长 >10%/月 | Cloudflare Web Analytics |

### 11.2 告警配置

```typescript
// 爬虫告警
if (errorCount > 10) {
  await sendAlert(`爬虫错误过多: ${errorCount}`);
}

// AI API 告警
if (apiLatency > 5000) {
  await sendAlert(`AI API 延迟过高: ${apiLatency}ms`);
}
```

---

## 十二、后续优化方向

1. **个性化推荐**: 基于阅读历史推荐新闻
2. **智能摘要**: 多模型对比生成最优摘要
3. **跨语言检索**: 英文新闻自动翻译中文
4. **语音朗读**: TTS 集成，通勤听新闻
5. **Chrome 扩展**: 浏览器插件快速收藏

---

**文档版本**: v1.0
**最后更新**: 2025-12-29
**维护者**: AI News Team
