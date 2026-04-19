import type { ReactNode } from "react";

export type DsMetricTileProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
};

export function DsMetricTile({ label, value, sub, className = "" }: DsMetricTileProps) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] py-3 ${className}`.trim()}
    >
      <p className="ds-caption truncate">{label}</p>
      <div className="ds-tabular mt-1 truncate text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </div>
      {sub ? <div className="mt-1 min-w-0 text-xs text-[var(--text-secondary)]">{sub}</div> : null}
    </div>
  );
}
