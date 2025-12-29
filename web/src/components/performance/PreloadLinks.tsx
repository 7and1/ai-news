import type { ReactNode } from 'react';

type PreloadLink = {
  href: string;
  as: 'script' | 'style' | 'font' | 'image' | 'fetch';
  type?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
};

type DnsPrefetch = {
  href: string;
};

type Preconnect = {
  href: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
};

interface PreloadLinksProps {
  preload?: PreloadLink[];
  dnsPrefetch?: DnsPrefetch[];
  preconnect?: Preconnect[];
}

/**
 * Resource preloading component for Core Web Vitals optimization
 *
 * This component adds resource hints to improve LCP by:
 * - Preloading critical resources
 * - Preconnecting to important origins
 * - DNS prefetching for external domains
 *
 * Include this in the head section of your root layout.
 */
export function PreloadLinks({
  preload = [],
  dnsPrefetch = [],
  preconnect = [],
}: PreloadLinksProps): ReactNode {
  return (
    <>
      {/* DNS Prefetch - resolve DNS early for external domains */}
      {dnsPrefetch.map(({ href }) => (
        <link key={`dns-${href}`} rel="dns-prefetch" href={href} />
      ))}

      {/* Preconnect - establish connection early to important origins */}
      {preconnect.map(({ href, crossOrigin }) => (
        <link key={`preconnect-${href}`} rel="preconnect" href={href} crossOrigin={crossOrigin} />
      ))}

      {/* Preload - load critical resources early */}
      {preload.map(({ href, as, type, crossOrigin }) => (
        <link
          key={`preload-${href}`}
          rel="preload"
          href={href}
          as={as}
          type={type}
          crossOrigin={crossOrigin}
        />
      ))}
    </>
  );
}

/**
 * Default preloads for BestBlogs.dev
 * Modify based on your most critical resources
 */
export function DefaultPreloadLinks(): ReactNode {
  return (
    <PreloadLinks
      preconnect={[
        { href: 'https://fonts.googleapis.com' },
        { href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      ]}
    />
  );
}
