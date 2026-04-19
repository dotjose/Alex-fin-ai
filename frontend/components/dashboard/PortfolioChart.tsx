import { memo, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { FinancialCard, EmptyState } from "@/components/ui/FinancialCard";
import { formatUsd, formatPercentOfWhole } from "@/lib/format";
import { useRechartsTheme } from "@/lib/useRechartsTheme";

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface PortfolioChartProps {
  loading: boolean;
  totalPositionsCount: number;
  assetClassBreakdown: Record<string, number>;
  totalValue: number;
}

function ChartSkeleton() {
  return (
    <FinancialCard>
      <div className="h-4 w-44 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-8 h-64 animate-pulse rounded-lg bg-[var(--border)]" />
    </FinancialCard>
  );
}

function PortfolioChartInner({
  loading,
  totalPositionsCount,
  assetClassBreakdown,
  totalValue,
}: PortfolioChartProps) {
  const rt = useRechartsTheme();
  const pieData = useMemo(() => {
    const rows = Object.entries(assetClassBreakdown)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: formatLabel(key),
        value: Math.round(value * 100) / 100,
        percentage: formatPercentOfWhole(value, totalValue),
      }));
    return rows;
  }, [assetClassBreakdown, totalValue]);

  if (loading) {
    return <ChartSkeleton />;
  }

  if (totalPositionsCount === 0) {
    return (
      <FinancialCard>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Portfolio allocation (donut)
        </h3>
        <div className="mt-6">
          <EmptyState
            title="No positions to chart"
            description="Add positions under your accounts. The chart appears only when the API returns holdings with prices and optional instrument allocation weights."
            actionLabel="Connect account / Add portfolio"
            actionHref="/accounts"
          />
        </div>
      </FinancialCard>
    );
  }

  if (pieData.length === 0) {
    return (
      <FinancialCard>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Portfolio allocation (donut)
        </h3>
        <div className="mt-6">
          <EmptyState
            title="No data available"
            description="Positions exist, but there is no positive valued allocation to plot yet. Check instrument prices and allocation metadata from your API."
            actionLabel="Manage accounts"
            actionHref="/accounts"
          />
        </div>
      </FinancialCard>
    );
  }

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--text-primary)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <FinancialCard>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        Portfolio allocation (donut)
      </h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Weighted from positions and instrument allocation fields when present.
      </p>
      <div className="mt-6 h-72 w-full min-h-[288px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
              stroke="var(--bg)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {pieData.map((d, i) => (
                <Cell
                  key={`${d.name}-${i}`}
                  fill={rt.series[i % rt.series.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--text-secondary)", fontSize: 11 }}
              itemStyle={{ color: "var(--text-primary)" }}
              formatter={(value: number, _n, item) => {
                const pct = (item?.payload as { percentage?: number })
                  ?.percentage;
                const pctStr =
                  pct !== undefined ? ` (${pct}% of portfolio)` : "";
                return [`${formatUsd(value)}${pctStr}`, "Value"];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)]">
        {pieData.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: rt.series[i % rt.series.length],
              }}
            />
            <span className="text-[var(--text-primary)]">
              {d.name}{" "}
              <span className="text-[var(--text-secondary)]">
                ({d.percentage}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </FinancialCard>
  );
}

export default memo(PortfolioChartInner);
