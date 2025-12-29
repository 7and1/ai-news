# Performance Optimization Guide

This document describes the performance optimizations implemented for BestBlogs.dev and how to maintain them.

## Core Web Vitals Targets

| Metric | Good    | Needs Improvement | Poor    |
| ------ | ------- | ----------------- | ------- |
| LCP    | < 2.5s  | < 4s              | > 4s    |
| FID    | < 100ms | < 300ms           | > 300ms |
| CLS    | < 0.1   | < 0.25            | > 0.25  |
| FCP    | < 1.8s  | < 3s              | > 3s    |
| TTFB   | < 800ms | < 1.8s            | > 1.8s  |
| INP    | < 200ms | < 500ms           | > 500ms |

## Implemented Optimizations

### 1. Next.js Configuration (next.config.ts)

- Image Optimization: AVIF/WebP formats, responsive sizes
- ISR (Incremental Static Regeneration): Pages revalidate at configured intervals
- PPR (Partial Prerendering): Enabled for hybrid static/dynamic content
- Modular Imports: Tree-shaking for lucide-react and date-fns
- Bundle Analysis: Run npm run build:analyze to analyze bundle size

### 2. Cache Strategy

#### Page-Level Caching

- Homepage: 5 minutes ISR (revalidate = 300)
- Latest page: 2 minutes ISR (revalidate = 120)
- News detail: 1 hour ISR (revalidate = 3600)

#### HTTP Caching

- Static assets: 1 year immutable
- Images: 7 days with stale-while-revalidate
- API routes: 5 minutes with stale-while-revalidate
- RSS feed: 10 minutes with stale-while-revalidate

### 3. Database Optimization

#### Indexes

Run performance indexes:
npm run d1:migrate:perf

Key indexes:

- idx_news_published_importance: Covers main news listing query
- idx_news_category_published: Category filtering
- idx_news_top_covering: High-importance news query
- idx_sources_active_crawl: Crawler optimization

### 4. Component Optimization

#### CSS Containment

News cards use content-visibility for off-screen rendering

### 5. Image Optimization

Use the OptimizedImage component for blur placeholders and lazy loading

### 6. Web Vitals Monitoring

Metrics are automatically collected and sent to /api/web-vitals

## Performance Monitoring

### Bundle Analysis

npm run build:analyze

### Database Query Analysis

EXPLAIN QUERY PLAN SELECT \* FROM news ORDER BY published_at DESC LIMIT 20;

## Performance Budgets

### JavaScript

- Main bundle: < 200 KB gzipped
- Each route chunk: < 100 KB gzipped
- Total initial JS: < 300 KB gzipped

### CSS

- Total CSS: < 30 KB gzipped

### Images

- Hero image: < 500 KB
- Content images: < 200 KB each
- Thumbnails: < 50 KB each
