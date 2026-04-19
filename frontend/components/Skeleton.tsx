export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-[var(--border)] ${className}`} />
);

export const SkeletonText = ({ lines = 1 }: { lines?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full" />
    ))}
  </div>
);

export const SkeletonCard = () => (
  <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)]">
    <Skeleton className="mb-4 h-6 w-1/3" />
    <SkeletonText lines={3} />
  </div>
);

export const SkeletonTable = ({ rows = 3 }: { rows?: number }) => (
  <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
    <div className="border-b border-[var(--border)] p-4">
      <Skeleton className="h-6 w-1/4" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex space-x-4 border-b border-[var(--border)] p-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
      </div>
    ))}
  </div>
);
