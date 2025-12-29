import bundleAnalyzer from '@next/bundle-analyzer';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

// Bundle analyzer
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

if (process.env.NODE_ENV === 'development') {
  void initOpenNextCloudflareForDev();
}

// Known domains for external images - restrict to specific sources
const KNOWN_IMAGE_DOMAINS = [
  'bestblogs.dev',
  '*.bestblogs.dev',
  'staging.bestblogs.dev',
  'images.unsplash.com',
  'avatar.vercel.sh',
  'github.com',
  'raw.githubusercontent.com',
  'cdn.jsdelivr.net',
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  // =============================================================================
  // IMAGE OPTIMIZATION - Core Web Vitals (LCP)
  // =============================================================================
  images: {
    // Enable optimization for all images
    unoptimized: false,
    // Modern formats for better compression (AVIF > WebP > JPEG/PNG)
    formats: ['image/avif', 'image/webp'],
    // Responsive breakpoints matching common device widths
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for srcset (thumbnails, avatars, etc.)
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Security settings for SVG images
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Restrict external image sources to known domains only
    remotePatterns: KNOWN_IMAGE_DOMAINS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },

  // =============================================================================
  // COMPILER OPTIMIZATIONS - Bundle Size Reduction
  // =============================================================================
  experimental: {
    // Optimize package imports for smaller bundles
    optimizePackageImports: ['lucide-react', 'date-fns', 'marked', 'sanitize-html'],
    // Optimize CSS imports
    optimizeCss: true,
  },

  // =============================================================================
  // COMPRESSION
  // =============================================================================
  compress: true,

  // =============================================================================
  // SOURCE MAPS - Disable for smaller production bundles
  // =============================================================================
  productionBrowserSourceMaps: false,

  // =============================================================================
  // URL CONFIGURATION
  // =============================================================================
  trailingSlash: false,
  skipTrailingSlashRedirect: false,

  // =============================================================================
  // BUILD OPTIMIZATIONS
  // =============================================================================
  // Modularize imports for smaller bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },

  // =============================================================================
  // CACHE CONFIGURATION - ISR & Edge Caching
  // =============================================================================
  generateBuildId: async () => {
    // Use git commit hash for reproducible builds
    if (process.env.GIT_COMMIT_SHA) {
      return process.env.GIT_COMMIT_SHA.slice(0, 12);
    }
    // Fallback to timestamp for non-git builds
    return `build-${Date.now()}`;
  },

  // =============================================================================
  // HTTP HEADERS - Security & Caching
  // =============================================================================
  async headers() {
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
      // Content Security Policy - restrict sources for all content
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: https: blob:;",
          "font-src 'self' data:;",
          "connect-src 'self' https://api.bestblogs.dev https://*.bestblogs.dev;",
          "frame-ancestors 'none';",
          "base-uri 'self';",
          "form-action 'self';",
        ].join(' '),
      },
    ];

    // Long-term cache for immutable static assets
    const immutableCacheHeaders = [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable',
      },
    ];

    // Short-term cache with stale-while-revalidate for dynamic content
    const staleWhileRevalidateHeaders = [
      {
        key: 'Cache-Control',
        value: 'public, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400',
      },
    ];

    // RSS feed cache
    const rssCacheHeaders = [
      {
        key: 'Cache-Control',
        value: 'public, max-age=600, stale-while-revalidate=1800',
      },
      { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
    ];

    return [
      // Static assets - immutable (hash-based filenames)
      {
        source: '/static/:path*',
        headers: [...securityHeaders, ...immutableCacheHeaders],
      },
      // Next.js optimized images - 7 days cache
      {
        source: '/_next/image/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      // Static JS/CSS chunks - immutable
      {
        source: '/_next/static/:path*',
        headers: [...securityHeaders, ...immutableCacheHeaders],
      },
      // Public assets - immutable
      {
        source: '/:path(favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml)',
        headers: [...securityHeaders, ...immutableCacheHeaders],
      },
      // API routes - short cache with SWR
      {
        source: '/api/:path*',
        headers: [...securityHeaders, ...staleWhileRevalidateHeaders],
      },
      // Public API endpoints
      {
        source: '/api/v1/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      // RSS feed
      {
        source: '/rss.xml',
        headers: [...securityHeaders, ...rssCacheHeaders],
      },
      // OG images - cache for 24 hours
      {
        source: '/og/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=172800',
          },
        ],
      },
      // Default headers for all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // =============================================================================
  // REDIRECTS - SEO & Performance
  // =============================================================================
  async redirects() {
    return [];
  },

  // =============================================================================
  // REWRITES - API Proxying
  // =============================================================================
  async rewrites() {
    return [];
  },
};

// Export with bundle analyzer wrapper
export default withBundleAnalyzer(nextConfig);
