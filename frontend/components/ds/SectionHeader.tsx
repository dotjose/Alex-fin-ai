import type { ReactNode } from "react";

export type DsSectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function DsSectionHeader({ title, description, action, className = "" }: DsSectionHeaderProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
    >
      <div className="min-w-0">
        <h2 className="ds-h2 break-words">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
