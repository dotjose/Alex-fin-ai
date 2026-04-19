import type { ReactNode } from "react";

export type DsDataTableProps = {
  children: ReactNode;
  className?: string;
};

/** Horizontal scroll only inside wrapper — page never scrolls sideways. */
export function DsDataTable({ children, className = "" }: DsDataTableProps) {
  return (
    <div
      className={`max-w-full overflow-x-auto overflow-y-visible rounded-[12px] border border-[var(--border)] ${className}`.trim()}
    >
      {children}
    </div>
  );
}
