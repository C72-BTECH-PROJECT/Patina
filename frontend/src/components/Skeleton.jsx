import React from 'react';

/**
 * Skeleton — Loading placeholder with shimmer animation
 *
 * @param {Object} props
 * @param {'text' | 'circular' | 'rectangular' | 'card'} props.variant
 * @param {string} props.width - CSS width (e.g., '100%', '200px')
 * @param {string} props.height - CSS height (e.g., '20px', '100%')
 * @param {string} props.className
 */
function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  ...props
}) {
  const variants = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
    card: 'rounded-xl',
  };

  const style = {
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <div
      className={`skeleton ${variants[variant]} ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * StatCardSkeleton — Skeleton for stat cards
 */
export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="circular" width="40px" height="40px" />
        <Skeleton width="48px" height="20px" />
      </div>
      <Skeleton width="100px" height="28px" className="mb-1" />
      <Skeleton width="140px" height="16px" />
    </div>
  );
}

/**
 * TableSkeleton — Skeleton for table/list rows
 */
export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <Skeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height="16px" />
            <Skeleton width="40%" height="12px" />
          </div>
          <Skeleton width="60px" height="24px" />
        </div>
      ))}
    </div>
  );
}

/**
 * ChartSkeleton — Skeleton for chart areas
 */
export function ChartSkeleton({ height = '250px' }) {
  return (
    <div className="card p-6">
      <Skeleton width="160px" height="20px" className="mb-4" />
      <div className="space-y-2" style={{ height }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-end gap-2 h-full">
            <Skeleton
              variant="rectangular"
              width="100%"
              height={`${30 + Math.random() * 70}%`}
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CardGridSkeleton — Skeleton for a grid of cards
 */
export function CardGridSkeleton({ count = 6, cols = 3 }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width="36px" height="36px" />
            <div className="flex-1 space-y-2">
              <Skeleton width="70%" height="16px" />
              <Skeleton width="50%" height="12px" />
            </div>
          </div>
          <Skeleton variant="rectangular" width="100%" height="80px" />
          <div className="flex gap-2">
            <Skeleton width="60px" height="24px" />
            <Skeleton width="80px" height="24px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
