import { Wallet, Shield, Building2 } from "lucide-react";
import { formatUsd } from "@/lib/format";
import type { RiskBadge } from "@/lib/dashboardRiskBadge";

function badgeClass(variant: RiskBadge["variant"]): string {
  switch (variant) {
    case "warn":
      return "border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] text-[var(--text-primary)]";
    case "accent":
      return "border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] text-[var(--text-primary)]";
    default:
      return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]";
  }
}

export type DashboardHeroKpisProps = {
  loading: boolean;
  totalValue: number;
  accountCount: number;
  riskBadge: RiskBadge;
  /** Book-derived 0–100 risk index (shown under posture when portfolio has value). */
  riskScore?: number | null;
};

export function DashboardHeroKpis({
  loading,
  totalValue,
  accountCount,
  riskBadge,
  riskScore = null,
}: DashboardHeroKpisProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-[var(--space-6)] md:grid-cols-3">
      <div className="ds-grid-item min-w-0 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Wallet className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
          <p className="ds-caption normal-case tracking-normal">Portfolio value</p>
        </div>
        {loading ? (
          <div className="mt-[var(--space-3)] h-9 w-40 animate-pulse rounded bg-[var(--border)]" />
        ) : (
          <p className="ds-hero-metric mt-[var(--space-2)] truncate tabular-nums text-[var(--text-primary)]">
            {totalValue > 0
              ? formatUsd(totalValue)
              : accountCount === 0
                ? "Add accounts"
                : "Build positions"}
          </p>
        )}
      </div>
      <div className="ds-grid-item min-w-0 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Shield className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
          <p className="ds-caption normal-case tracking-normal">Risk posture</p>
        </div>
        {loading ? (
          <div className="mt-[var(--space-3)] h-7 w-24 animate-pulse rounded bg-[var(--border)]" />
        ) : (
          <div className="mt-[var(--space-3)] min-w-0">
            <span
              className={`inline-flex max-w-full truncate rounded-[10px] border px-3 py-1 text-[13px] font-semibold ${badgeClass(riskBadge.variant)}`}
            >
              {riskBadge.label}
            </span>
            {riskScore != null && Number.isFinite(riskScore) && totalValue > 0 ? (
              <p className="mt-[var(--space-2)] text-[11px] tabular-nums text-[var(--text-secondary)]">
                Risk index <span className="font-semibold text-[var(--text-primary)]">{Math.round(riskScore)}</span>
                /100
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="ds-grid-item min-w-0 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Building2 className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
          <p className="ds-caption normal-case tracking-normal">Accounts</p>
        </div>
        {loading ? (
          <div className="mt-[var(--space-3)] h-8 w-12 animate-pulse rounded bg-[var(--border)]" />
        ) : (
          <p className="ds-hero-metric mt-[var(--space-2)] tabular-nums text-[var(--text-primary)]">{accountCount}</p>
        )}
      </div>
    </div>
  );
}
