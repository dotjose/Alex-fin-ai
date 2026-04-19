import Link from "next/link";
import { formatUsd } from "@/lib/format";
import type { RiskBadge } from "@/lib/dashboardRiskBadge";
import { formatDataFreshness } from "@/lib/dashboardFreshness";

export interface DashboardSummaryStripProps {
  loading: boolean;
  accountCount: number;
  totalValue: number;
  lastAnalysisLabel: string | null;
  riskBadge: RiskBadge;
  dataFreshAt: Date | null;
  /** Session vs prior snapshot from job timeline, percent (e.g. +1.2 or -0.4). */
  performanceDeltaPct: number | null;
}

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

function analysisFreshnessLabel(label: string | null): string {
  if (!label || !label.trim()) return "Not run yet";
  return label;
}

function formatDelta(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default function DashboardSummaryStrip({
  loading,
  accountCount,
  totalValue,
  lastAnalysisLabel,
  riskBadge,
  dataFreshAt,
  performanceDeltaPct,
}: DashboardSummaryStripProps) {
  const valueLine =
    loading
      ? null
      : totalValue > 0
        ? formatUsd(totalValue)
        : accountCount === 0
          ? null
          : "Initializing portfolio intelligence";

  return (
    <div className="sticky top-16 z-10 -mx-6 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-6 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-nowrap items-center gap-6 overflow-x-auto pb-1 sm:gap-8">
        <div className="min-w-[140px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Portfolio value
          </p>
          {loading ? (
            <div className="mt-1.5 space-y-1">
              <div className="h-8 w-32 animate-pulse rounded-md bg-[var(--border)]" />
              <p className="text-[10px] text-[var(--text-secondary)]">Initializing portfolio intelligence</p>
            </div>
          ) : valueLine ? (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[1.65rem] leading-none">
              {valueLine}
            </p>
          ) : (
            <div className="mt-1">
              <p className="text-lg font-semibold leading-snug text-[var(--text-primary)]">Connect to begin</p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-secondary)]">
                Connect your first account to generate intelligence.
              </p>
            </div>
          )}
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-[var(--border)] sm:block" aria-hidden />

        <div className="min-w-[100px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Posture
          </p>
          {loading ? (
            <div className="mt-1.5 h-6 w-[4.5rem] animate-pulse rounded-md bg-[var(--border)]" />
          ) : (
            <span
              className={`mt-1.5 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(riskBadge.variant)}`}
            >
              {riskBadge.label}
            </span>
          )}
        </div>

        <div className="min-w-[72px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Accounts
          </p>
          {loading ? (
            <div className="mt-1.5 h-7 w-8 animate-pulse rounded-md bg-[var(--border)]" />
          ) : (
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text-primary)]">{accountCount}</p>
          )}
        </div>

        <div className="min-w-[88px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Session Δ
          </p>
          {loading ? (
            <div className="mt-1.5 h-7 w-14 animate-pulse rounded-md bg-[var(--border)]" />
          ) : (
            <p
              className={`mt-0.5 text-lg font-semibold tabular-nums tracking-tight leading-none ${
                performanceDeltaPct != null && performanceDeltaPct > 0
                  ? "text-[var(--success)]"
                  : performanceDeltaPct != null && performanceDeltaPct < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--text-primary)]"
              }`}
            >
              {formatDelta(performanceDeltaPct)}
            </p>
          )}
        </div>

        <div className="min-w-[100px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Last analysis
          </p>
          {loading ? (
            <div className="mt-1.5 h-6 w-24 animate-pulse rounded-md bg-[var(--border)]" />
          ) : (
            <p className="mt-0.5 whitespace-nowrap rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-primary)]">
              {analysisFreshnessLabel(lastAnalysisLabel)}
            </p>
          )}
        </div>

        <div className="min-w-[88px] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Data feed
          </p>
          {loading ? (
            <div className="mt-1.5 h-5 w-16 animate-pulse rounded-md bg-[var(--border)]" />
          ) : (
            <p className="mt-0.5 whitespace-nowrap text-xs font-medium tabular-nums text-[var(--text-primary)]">
              {formatDataFreshness(dataFreshAt)}
            </p>
          )}
        </div>

        {accountCount === 0 && !loading ? (
          <Link
            href="/accounts"
            className="ml-auto shrink-0 rounded-md bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:opacity-95 sm:ml-0"
          >
            Add account
          </Link>
        ) : null}
      </div>
    </div>
  );
}
