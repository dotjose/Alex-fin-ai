import type { ReactNode } from "react";

export type DsBadgeProps = {
  children: ReactNode;
  variant?: "neutral" | "accent" | "warn" | "danger";
  className?: string;
};

const variants: Record<NonNullable<DsBadgeProps["variant"]>, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
  accent:
    "border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] text-[var(--text-primary)]",
  warn: "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] text-[var(--text-primary)]",
  danger:
    "border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] text-[var(--text-primary)]",
};

export function DsBadge({ children, variant = "neutral", className = "" }: DsBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-[var(--radius-control)] border px-2 py-0.5 text-[11px] font-semibold ${variants[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
