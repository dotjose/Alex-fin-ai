import Link from "next/link";
import type { ReactNode } from "react";

type Padding = "md" | "lg";

const paddingClass: Record<Padding, string> = {
  md: "p-[var(--space-4)]",
  lg: "p-[var(--space-6)]",
};

export interface FinancialCardProps {
  children: ReactNode;
  className?: string;
  padding?: Padding;
  /** Dense dashboard panels: border-forward, minimal shadow. */
  elevation?: "default" | "flat";
}

/**
 * Unified surface: theme tokens, consistent radius and padding.
 */
export function FinancialCard({
  children,
  className = "",
  padding = "lg",
  elevation = "default",
}: FinancialCardProps) {
  const shadowClass =
    elevation === "flat"
      ? "shadow-none hover:border-[color-mix(in_srgb,var(--accent)_22%,var(--border))]"
      : "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]";
  return (
    <section
      className={`ds-card-interactive min-w-0 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] ${paddingClass[padding]} ${shadowClass} ${className}`.trim()}
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
