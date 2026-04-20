"use client";

import { memo, useCallback, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DashboardChartTooltip } from "@/components/dashboard/v2/CustomTooltip";
import { fillForPieKey } from "@/lib/chartSeriesColor";
import { formatUsd } from "@/lib/format";
import { useHtmlDarkClass } from "@/lib/useHtmlDarkClass";
import type { DashboardChartModel, PieRow } from "@/lib/useDashboardChartModel";
import type { RechartsTheme } from "@/lib/useRechartsTheme";

const EMPTY: PieRow[] = [{ key: "empty", name: "No data", value: 1, percentage: 100, ghost: true }];

export type AllocationDonutPanelProps = {
  model: DashboardChartModel;
  rt: RechartsTheme;
  loading?: boolean;
};

export const AllocationDonutPanel = memo(function AllocationDonutPanel({
  model,
  rt,
  loading,
}: AllocationDonutPanelProps) {
  const dark = useHtmlDarkClass();
  const ringStroke = dark ? "#171717" : "#ffffff";

  const { pieData, chartMode } = model;
  const safe = useMemo(() => {
    const rows = Array.isArray(pieData) ? pieData.filter((d) => d && Number.isFinite(d.value) && d.value > 0) : [];
    return rows.length ? rows : EMPTY;
  }, [pieData]);

  const donutTooltip = useCallback(
    (props: { active?: boolean; payload?: { name?: string; value?: number }[] }) => (
      <DashboardChartTooltip
        active={props.active}
        label={props.payload?.[0]?.name}
        payload={props.payload as never}
        valueFormatter={(v) => formatUsd(v)}
      />
    ),
    [],
  );

  if (loading) {
    return (
      <div className="h-[300px] w-full animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
    );
  }

  return (
    <div className="flex h-[300px] w-full min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Allocation</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">By sleeve (book-weighted)</p>
      <div className="relative mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safe}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={chartMode === "live" ? 2 : 1}
              stroke={ringStroke}
              strokeWidth={2}
            >
              {safe.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={fillForPieKey(d.key, {
                    ghost: Boolean(d.ghost),
                    index: i,
                    gridFallback: rt.grid,
                    series: rt.series,
                  })}
                />
              ))}
            </Pie>
            <Tooltip content={donutTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
