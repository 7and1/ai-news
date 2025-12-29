import { cn } from '@/lib/utils';

type SkeletonProps = {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
};

/**
 * Skeleton loading component for CLS prevention
 *
 * Use skeleton loaders to reserve space while content loads,
 * preventing layout shifts and improving CLS scores.
 */
export function Skeleton({ className, variant = 'rectangular', width, height }: SkeletonProps) {
  const variantStyles = {
    text: 'rounded h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-zinc-200 dark:bg-zinc-800',
        variantStyles[variant],
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * News card skeleton for the grid
 */
export function NewsCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-black">
      <div className="flex items-start justify-between gap-3">
        <Skeleton variant="text" className="h-6 w-3/4" />
        <Skeleton variant="rectangular" className="h-6 w-10" />
      </div>
      <Skeleton variant="text" className="mt-4 h-4 w-full" />
      <Skeleton variant="text" className="mt-2 h-4 w-2/3" />
      <div className="mt-4 flex gap-2">
        <Skeleton variant="rectangular" className="h-6 w-16" />
        <Skeleton variant="rectangular" className="h-6 w-16" />
        <Skeleton variant="rectangular" className="h-6 w-16" />
      </div>
    </div>
  );
}

/**
 * News grid skeleton
 */
export function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}
