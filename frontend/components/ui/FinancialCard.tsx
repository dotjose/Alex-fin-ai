import Link from "next/link";
import type { ReactNode } from "react";

type Padding = "md" | "lg";

const paddingClass: Record<Padding, string> = {
  md: "p-6",
  lg: "p-8",
};

export interface FinancialCardProps {
  children: ReactNode;
  className?: string;
  padding?: Padding;
}

/**
 * Unified surface: theme tokens, consistent radius and padding.
 */
export function FinancialCard({
  children,
  className = "",
  padding = "lg",
}: FinancialCardProps) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] ${paddingClass[padding]} shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="text-left">
      <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
