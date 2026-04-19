import { TrendingUp } from "lucide-react";
import { FinancialCard } from "@/components/ui/FinancialCard";
import type { DashboardChartModel } from "@/lib/useDashboardChartModel";
import { DashboardSparkPanel } from "@/components/dashboard/DashboardChartPanels";

type Props = {
  model: DashboardChartModel;
  performanceDeltaPct: number | null;
  lastAnalysisLabel: string | null;
  loading: boolean;
};

function formatDelta(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function DashboardPerformanceCard({
  model,
  performanceDeltaPct,
  lastAnalysisLabel,
  loading,
}: Props) {
  if (loading) {
    return (
      <FinancialCard padding="md" elevation="flat" className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-4 h-24 animate-pulse rounded-[10px] bg-[var(--border)]" />
      </FinancialCard>
    );
  }

  return (
    <FinancialCard padding="md" elevation="flat" className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <TrendingUp className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p className="ds-caption normal-case tracking-normal text-[var(--text-secondary)]">Performance</p>
          <p className="ds-h3 mt-0.5">Session & trend</p>
        </div>
      </div>
      <div className="mt-[var(--space-3)] grid min-w-0 grid-cols-2 gap-[var(--space-3)]">
        <div className="min-w-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="ds-caption">Session Δ</p>
          <p
            className={`ds-h3 mt-1 tabular-nums ${
              performanceDeltaPct != null && performanceDeltaPct > 0
                ? "text-[var(--success)]"
                : performanceDeltaPct != null && performanceDeltaPct < 0
                  ? "text-[var(--danger)]"
                  : ""
            }`}
          >
            {formatDelta(performanceDeltaPct)}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="ds-caption">Last run</p>
          <p className="mt-1 truncate text-[12px] font-medium text-[var(--text-primary)]">
            {lastAnalysisLabel?.trim() ? lastAnalysisLabel : "—"}
          </p>
        </div>
      </div>
      <div className="mt-[var(--space-4)] min-h-0 min-w-0 flex-1 overflow-hidden">
        <DashboardSparkPanel model={model} embedded />
      </div>
    </FinancialCard>
  );
}
