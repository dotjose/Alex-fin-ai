import type { ReactNode } from "react";

export type AppPageHeroProps = {
  title: string;
  subtitle?: string;
  /** Primary actions (e.g. CTA) — aligned end on wide viewports. */
  actions?: ReactNode;
  kpi?: ReactNode;
};

/**
 * Standard page hero: H1, optional subtitle, optional KPI strip.
 * Spacing: 32px top, 24px bottom (tokens).
 */
export function AppPageHero({ title, subtitle, actions, kpi }: AppPageHeroProps) {
  return (
    <header className="min-w-0 overflow-hidden pt-[var(--space-8)] pb-[var(--space-6)]">
      <div className="ds-hero-inner">
        <div className="flex min-w-0 flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="ds-h1 break-words">{title}</h1>
            {subtitle ? (
              <p className="ds-body mt-[var(--space-2)] max-w-prose text-[var(--text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-[var(--space-2)]">{actions}</div>
          ) : null}
        </div>
        {kpi ? (
          <div className="mt-[var(--space-6)] min-w-0 overflow-hidden">{kpi}</div>
        ) : null}
      </div>
    </header>
  );
}
