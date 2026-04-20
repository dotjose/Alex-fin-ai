import type { ReactNode } from "react";

const pad = {
  none: "",
  sm: "p-[var(--space-2)]",
  md: "p-[var(--space-4)]",
  lg: "p-[var(--space-6)]",
} as const;

export type DsCardProps = {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof pad;
};

/** Bordered surface — min-w-0 + overflow hidden to prevent flex/grid blowout. */
export function DsCard({ children, className = "", padding = "lg" }: DsCardProps) {
  return (
    <section
      className={`ds-card-interactive min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] ${pad[padding]} ${className}`.trim()}
    >
      {children}
    </section>
  );
}
