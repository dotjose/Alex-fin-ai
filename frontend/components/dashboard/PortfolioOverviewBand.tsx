import { FinancialCard } from "@/components/ui/FinancialCard";
import { formatUsd } from "@/lib/format";
import type { DashboardChartModel } from "@/lib/useDashboardChartModel";
import type { RechartsTheme } from "@/lib/useRechartsTheme";
import { AllocationDonutChart } from "./DashboardChartPanels";

export type PortfolioOverviewBandProps = {
  loading: boolean;
  totalValue: number;
  performanceDeltaPct: number | null;
  chartModel: DashboardChartModel;
  rt: RechartsTheme;
  hasAccounts: boolean;
  analysisRunning: boolean;
  onAddAccount: () => void;
  onAddPosition: () => void;
  onRunAnalysis: () => void;
};

function deltaTone(pct: number): string {
  if (pct > 0.02) return "text-[var(--success)]";
  if (pct < -0.02) return "text-[var(--danger)]";
  return "text-[var(--text-secondary)]";
}

export function PortfolioOverviewBand({
  loading,
  totalValue,
  performanceDeltaPct,
  chartModel,
  rt,
  hasAccounts,
  analysisRunning,
  onAddAccount,
  onAddPosition,
  onRunAnalysis,
}: PortfolioOverviewBandProps) {
  const showDelta =
    performanceDeltaPct != null &&
    Number.isFinite(performanceDeltaPct) &&
    totalValue > 0;
  const chartMode = chartModel.chartMode;

  if (loading) {
    return (
      <FinancialCard padding="lg" elevation="flat" className="min-w-0">
        <div className="grid gap-[var(--space-6)] lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-10 w-52 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-9 w-full max-w-md animate-pulse rounded bg-[var(--border)]" />
          </div>
          <div className="h-[200px] animate-pulse rounded-[var(--radius-card)] bg-[var(--surface)]" />
        </div>
      </FinancialCard>
    );
  }

  return (
    <FinancialCard
      padding="lg"
      elevation="flat"
      className="min-w-0 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="grid min-w-0 gap-[var(--space-6)] lg:grid-cols-[1fr_min(280px,40vw)] lg:items-center">
        <div className="min-w-0">
          <p className="ds-caption">Portfolio overview</p>
          <p className="ds-metric-xl mt-1 tabular-nums tracking-tight">
            {totalValue > 0 ? formatUsd(totalValue) : "Build your book"}
          </p>
          {showDelta ? (
            <p className={`mt-2 text-sm font-medium tabular-nums ${deltaTone(performanceDeltaPct)}`}>
              {performanceDeltaPct! >= 0 ? "+" : ""}
              {performanceDeltaPct!.toFixed(2)}% vs prior snapshot
            </p>
          ) : totalValue > 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Add another analysis run to unlock day-over-day change.
            </p>
          ) : (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              Add accounts and positions to track performance, allocation, and AI insights.
            </p>
          )}

          <div className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-2)]">
            <button
              type="button"
              onClick={onAddAccount}
              className="ds-btn-secondary min-h-[44px] px-4 text-sm"
            >
              Add account
            </button>
            <button
              type="button"
              onClick={onAddPosition}
              disabled={!hasAccounts}
              className="ds-btn-secondary min-h-[44px] px-4 text-sm disabled:opacity-45"
              title={!hasAccounts ? "Create an account first" : undefined}
            >
              Add position
            </button>
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={!hasAccounts || analysisRunning}
              className="ds-btn-primary min-h-[44px] px-4 text-sm disabled:opacity-45"
            >
              {analysisRunning ? "Analysis running…" : "Run analysis"}
            </button>
          </div>
        </div>

        <div
          className={`relative mx-auto w-full max-w-[280px] min-w-0 lg:mx-0 ${chartMode === "onboarding" ? "opacity-40" : ""}`}
        >
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] lg:text-left">
            Allocation
          </p>
          <AllocationDonutChart
            model={chartModel}
            rt={rt}
            className="h-[200px]"
            innerRadius={40}
            outerRadius={70}
          />
        </div>
      </div>
    </FinancialCard>
  );
}
