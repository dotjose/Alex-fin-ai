"use client";

import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardChartTooltip } from "@/components/dashboard/v2/CustomTooltip";
import { formatUsdDetailed } from "@/lib/format";
import { useHtmlDarkClass } from "@/lib/useHtmlDarkClass";
import type { RechartsTheme } from "@/lib/useRechartsTheme";

export type PerformanceLineChartProps = {
  data: { label: string; value: number; jobId?: string }[];
  rt: RechartsTheme;
  loading?: boolean;
};

export const PerformanceLineChart = memo(function PerformanceLineChart({
  data,
  rt,
  loading,
}: PerformanceLineChartProps) {
  const dark = useHtmlDarkClass();
  const axisStroke = dark ? "#737373" : "#9ca3af";
  const gridStroke = dark ? "#262626" : "#e5e7eb";

  const chartData = useMemo(
    () => (Array.isArray(data) && data.length ? data : [{ label: "—", value: 0 }]),
    [data],
  );

  const tooltipContent = useMemo(
    () =>
      function PerformanceTooltip(props: {
        active?: boolean;
        label?: string | number;
        payload?: { name?: string; value?: number }[];
      }) {
        return (
          <DashboardChartTooltip
            active={props.active}
            label={props.label}
            payload={props.payload as never}
            valueFormatter={(v) => formatUsdDetailed(v)}
            footer={<span className="text-gray-500 dark:text-gray-400">Book total at this point</span>}
          />
        );
      },
    [],
  );

  if (loading) {
    return (
      <div className="h-[320px] w-full animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
    );
  }

  return (
    <div className="h-[320px] w-full min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Performance
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Portfolio value across completed analyses</p>
      <div className="mt-4 h-[248px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axisStroke, fontSize: 11 }}
              axisLine={{ stroke: axisStroke }}
              tickLine={false}
            />
            <YAxis
              width={56}
              tick={{ fill: axisStroke, fontSize: 11 }}
              axisLine={{ stroke: axisStroke }}
              tickLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat(undefined, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(Number(v))
              }
            />
            <Tooltip
              cursor={{ stroke: gridStroke }}
              content={tooltipContent}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={rt.accent}
              strokeWidth={2.5}
              dot={{ r: 3, fill: rt.accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
