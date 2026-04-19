import type { ReactNode } from "react";

export type DsChartContainerProps = {
  title?: string;
  caption?: string;
  children: ReactNode;
  /** Renders below the fixed-height chart area (legends, notes). */
  footer?: ReactNode;
  className?: string;
  minHeight?: number;
};

/** Fixed-height chart shell — prevents parent flex collapse and horizontal bleed. */
export function DsChartContainer({
  title,
  caption,
  children,
  footer,
  className = "",
  minHeight = 208,
}: DsChartContainerProps) {
  return (
    <div
      className={`flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-4 ${className}`.trim()}
    >
      {title ? <p className="ds-h3 shrink-0">{title}</p> : null}
      {caption ? <p className="mt-1 shrink-0 text-[11px] text-[var(--text-secondary)]">{caption}</p> : null}
      <div
        className="mt-3 min-h-0 min-w-0 w-full shrink-0 overflow-x-hidden"
        style={{ height: minHeight, minHeight }}
      >
        {children}
      </div>
      {footer ? <div className="mt-3 min-w-0 shrink-0">{footer}</div> : null}
    </div>
  );
}
