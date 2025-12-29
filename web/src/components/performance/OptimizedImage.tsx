'use client';

import Image from 'next/image';
import { type ComponentProps, useState } from 'react';

import { cn } from '@/lib/utils';

type OptimizedImageProps = ComponentProps<typeof Image> & {
  /**
   * Enable blur placeholder
   * @default true
   */
  blur?: boolean;
  /**
   * Enable lazy loading
   * @default true for below-fold images
   */
  lazy?: boolean;
  /**
   * Enable fade-in animation
   * @default true
   */
  fadeIn?: boolean;
  /**
   * Custom placeholder color
   */
  placeholderColor?: string;
};

/**
 * Optimized image component with blur placeholder and lazy loading
 *
 * This wrapper around Next.js Image adds:
 * - Blur placeholder during loading
 * - Fade-in animation for smooth loading
 * - CLS prevention by reserving space
 * - Lazy loading for below-fold images
 */
export function OptimizedImage({
  blur = true,
  lazy = true,
  fadeIn = true,
  placeholderColor = '#e5e7eb',
  className,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // For priority images (above-fold), disable lazy loading
  const loadingProp = priority || !lazy ? 'eager' : 'lazy';

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        isLoading && fadeIn && 'animate-in fade-in duration-300',
        className
      )}
      style={{
        backgroundColor: isLoading && blur ? placeholderColor : undefined,
      }}
    >
      {!error ? (
        <Image
          {...props}
          priority={priority}
          loading={loadingProp}
          className={cn('transition-opacity duration-300', isLoading ? 'opacity-0' : 'opacity-100')}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError(true);
          }}
        />
      ) : (
        // Fallback on error
        <div
          className="flex items-center justify-center bg-zinc-100 text-zinc-400"
          style={{ aspectRatio: `${props.width}/${props.height}` }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * Priority image for above-fold content
 * Use this for LCP-optimized images
 */
export function PriorityImage(props: ComponentProps<typeof Image>) {
  return <OptimizedImage {...props} priority lazy={false} fadeIn={false} />;
}

/**
 * Lazy-loaded image for below-fold content
 * Use this for images that appear after scrolling
 */
export function LazyImage(props: ComponentProps<typeof Image>) {
  return <OptimizedImage {...props} lazy />;
}
