import { useMemo } from "react";
import { formatPercentOfWhole, toNumber } from "@/lib/format";
import { portfolioValueTimeline } from "@/lib/dashboardChartData";
import type { ApiJob } from "@/lib/useDashboardData";

function formatLabel(key: string): string {
  if (key === "unclassified") return "Attribution pending";
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type PieRow = {
  key: string;
  name: string;
  value: number;
  percentage: number;
  ghost?: boolean;
};

export type DashboardChartMode = "live" | "cash" | "ghost" | "onboarding";

export type DashboardChartModel = {
  cashOnly: boolean;
  pieData: PieRow[];
  chartMode: DashboardChartMode;
  timelineChart: { label: string; value: number; jobId?: string }[];
  sparkRows: { i: number; value: number }[];
  sparkProxy: boolean;
  assetCards: { label: string; pct: number; color: string }[];
};

export type DashboardChartModelInput = {
  totalPositionsCount: number;
  assetClassBreakdown: Record<string, number>;
  totalValue: number;
  jobs: ApiJob[];
};

export function useDashboardChartModel({
  totalPositionsCount,
  assetClassBreakdown,
  totalValue,
  jobs,
}: DashboardChartModelInput): DashboardChartModel {
  const cashOnly =
    totalPositionsCount === 0 &&
    totalValue > 0 &&
    (assetClassBreakdown.cash ?? 0) >= totalValue * 0.995;

  const livePie = useMemo(() => {
    const rows: PieRow[] = Object.entries(assetClassBreakdown)
      .filter(([, v]) => toNumber(v) > 0)
      .map(([key, value]) => {
        const v = toNumber(value);
        return {
          key,
          name: formatLabel(key),
          value: Math.round(v * 100) / 100,
          percentage: formatPercentOfWhole(v, totalValue),
        };
      })
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [assetClassBreakdown, totalValue]);

  const { pieData, chartMode } = useMemo((): {
    pieData: PieRow[];
    chartMode: DashboardChartMode;
  } => {
    if (totalValue > 0 && livePie.length > 0) {
      return { pieData: livePie, chartMode: "live" as const };
    }
    if (totalValue > 0 && cashOnly) {
      return {
        pieData: [
          {
            key: "cash",
            name: "Cash",
            value: Math.round(totalValue * 100) / 100,
            percentage: 100,
          },
        ],
        chartMode: "cash" as const,
      };
    }
    if (totalValue > 0) {
      const v = Math.round(totalValue * 100) / 100;
      return {
        pieData: [
          {
            key: "pending",
            name: "Attribution pending",
            value: v,
            percentage: 100,
            ghost: true,
          },
        ],
        chartMode: "ghost" as const,
      };
    }
    const ghostVal = 25;
    return {
      pieData: [
        { key: "g1", name: "Equity (ref.)", value: ghostVal, percentage: 25, ghost: true },
        { key: "g2", name: "Bonds (ref.)", value: ghostVal, percentage: 25, ghost: true },
        { key: "g3", name: "Cash (ref.)", value: ghostVal, percentage: 25, ghost: true },
        { key: "g4", name: "Alts (ref.)", value: ghostVal, percentage: 25, ghost: true },
      ],
      chartMode: "onboarding" as const,
    };
  }, [totalValue, livePie, cashOnly]);

  const timeline = useMemo(() => portfolioValueTimeline(jobs, totalValue), [jobs, totalValue]);

  const timelineChart = useMemo(() => {
    if (timeline.length >= 2) return timeline;
    if (timeline.length === 1) {
      const p = timeline[0];
      if (!p) return [];
      return [p, { label: "Now", value: p.value }];
    }
    return [];
  }, [timeline]);

  const { sparkRows, sparkProxy } = useMemo(() => {
    if (timelineChart.length >= 2) {
      return {
        sparkRows: timelineChart.map((p, i) => ({ i, value: p.value })),
        sparkProxy: false,
      };
    }
    const seed = Math.max(totalValue, 1);
    const rows = Array.from({ length: 36 }, (_, i) => ({
      i,
      value: seed * (1 + 0.022 * Math.sin(i * 0.32)),
    }));
    return { sparkRows: rows, sparkProxy: true };
  }, [timelineChart, totalValue]);

  const assetCards = useMemo(() => {
    const eq = toNumber(assetClassBreakdown.equity);
    const cash = toNumber(assetClassBreakdown.cash);
    const bonds = toNumber(assetClassBreakdown.fixed_income);
    const alt = toNumber(assetClassBreakdown.alternatives);
    const denom = totalValue > 0 ? totalValue : 1;
    const colors = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)"];
    return [
      { label: "Equity", pct: (eq / denom) * 100, color: colors[0] },
      { label: "Cash", pct: (cash / denom) * 100, color: colors[1] },
      { label: "Bonds", pct: (bonds / denom) * 100, color: colors[2] },
      { label: "Alts", pct: (alt / denom) * 100, color: colors[3] },
    ];
  }, [assetClassBreakdown, totalValue]);

  return {
    cashOnly,
    pieData,
    chartMode,
    timelineChart,
    sparkRows,
    sparkProxy,
    assetCards,
  };
}
