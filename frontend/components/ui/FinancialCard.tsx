import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PieChart } from "lucide-react";
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
  id?: string;
}

/**
 * Unified surface: theme tokens, consistent radius and padding.
 */
export function FinancialCard({
  children,
  className = "",
  padding = "lg",
  elevation = "default",
  id,
}: FinancialCardProps) {
  const shadowClass =
    elevation === "flat"
      ? "shadow-none hover:border-[color-mix(in_srgb,var(--accent)_22%,var(--border))]"
      : "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]";
  return (
    <section
      id={id}
      className={`ds-card-interactive min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] ${paddingClass[padding]} ${shadowClass} ${className}`.trim()}
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
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon = PieChart,
}: EmptyStateProps) {
  return (
    <div className="text-left">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] transition duration-200 hover:opacity-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
