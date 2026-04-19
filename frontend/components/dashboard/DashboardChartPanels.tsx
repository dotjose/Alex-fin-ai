import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FinancialCard } from "@/components/ui/FinancialCard";
import { formatUsd } from "@/lib/format";
import type { DashboardChartModel, PieRow } from "@/lib/useDashboardChartModel";
import type { RechartsTheme } from "@/lib/useRechartsTheme";

function AssetPulseCard({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--card))] px-3 py-2 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_25%,var(--border))]">
      <div className="flex items-center justify-between gap-2">
        <span className="ds-caption normal-case tracking-normal">
          {label}
        </span>
        <span className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-normal text-[var(--text-primary)]">
          {w.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_55%,transparent)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${w}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const tooltipStyle = () => ({
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text-primary)",
});

type PanelProps = {
  model: DashboardChartModel;
  rt: RechartsTheme;
  loading?: boolean;
};

export function DashboardAllocationPanel({ model, rt }: PanelProps) {
  const { pieData, chartMode, cashOnly } = model;
  return (
    <FinancialCard
      padding="md"
      elevation="flat"
      className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="ds-h3">Allocation</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">Hover segments</p>
        </div>
        {cashOnly ? (
          <span className="shrink-0 rounded-[10px] border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            Cash-only
          </span>
        ) : null}
      </div>
      {chartMode === "onboarding" ? (
        <p className="mt-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-[12px] font-medium leading-snug text-[var(--text-primary)]">
          Connect your first account to generate intelligence.
        </p>
      ) : null}
      <div
        className={`mt-[var(--space-3)] h-[208px] w-full min-w-0 shrink-0 overflow-hidden ${chartMode === "onboarding" ? "opacity-[0.22]" : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={76}
              paddingAngle={chartMode === "live" ? 2 : 1}
              stroke="var(--bg)"
              strokeWidth={2}
            >
              {pieData.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={d.ghost ? rt.grid : rt.series[i % rt.series.length]}
                  fillOpacity={d.ghost ? 0.5 : 1}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(value: number, _n, item) => {
                const pct = (item?.payload as PieRow)?.percentage;
                const pctStr = pct !== undefined ? ` · ${pct}%` : "";
                return [`${formatUsd(value)}${pctStr}`, "Notional"];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex max-h-16 flex-wrap gap-x-3 gap-y-1 overflow-y-auto text-[11px] text-[var(--text-secondary)]">
        {pieData.map((d, i) => (
          <li key={d.key} className="flex min-w-0 items-center gap-1">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: d.ghost ? "var(--chart-4)" : rt.series[i % rt.series.length],
              }}
            />
            <span className="truncate text-[var(--text-primary)]">{d.name}</span>
            <span className="tabular-nums">{d.percentage}%</span>
          </li>
        ))}
      </ul>
    </FinancialCard>
  );
}

export function DashboardSparkPanel({
  model,
  embedded = false,
}: Pick<PanelProps, "model"> & { embedded?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `dash-spark-${uid}`;
  const { sparkRows, sparkProxy } = model;

  const chart = (
    <div className="h-14 w-full min-h-[56px] min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparkRows} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) {
    return (
      <div className="min-h-0 min-w-0 overflow-hidden">
        {sparkProxy ? (
          <p className="mb-2 text-[11px] text-[var(--text-secondary)]">Reference curve until history exists.</p>
        ) : null}
        {chart}
      </div>
    );
  }

  return (
    <FinancialCard padding="md" elevation="flat" className="min-h-[120px] min-w-0 border-[var(--border)]">
      <p className="ds-caption normal-case tracking-normal text-[var(--text-secondary)]">Portfolio trend</p>
      {sparkProxy ? (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Reference curve until history exists.</p>
      ) : null}
      <div className="mt-2">{chart}</div>
    </FinancialCard>
  );
}

export function DashboardExposurePanel({ model, rt }: PanelProps) {
  const { pieData } = model;
  return (
    <FinancialCard padding="md" elevation="flat" className="min-h-[var(--dash-row-height)] min-w-0">
      <p className="ds-h3">Exposure</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">By sleeve (USD)</p>
      <div className="mt-3 h-[208px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pieData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={rt.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: rt.textSecondary, fontSize: 9 }}
              axisLine={{ stroke: rt.grid }}
              tickLine={false}
              tickFormatter={(v) => formatUsd(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={92}
              tick={{ fill: rt.textSecondary, fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => [formatUsd(v), "Value"]} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
              {pieData.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={d.ghost ? rt.series[4] ?? rt.grid : rt.series[i % rt.series.length]}
                  fillOpacity={d.ghost ? 0.55 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </FinancialCard>
  );
}

export function DashboardHistoryPanel({ model, rt }: PanelProps) {
  const { timelineChart } = model;
  return (
    <FinancialCard padding="md" elevation="flat" className="min-h-[var(--dash-row-height)] min-w-0">
      <p className="ds-h3">History</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">Job-linked NAV</p>
      <div className="mt-3 h-[208px] w-full min-w-0">
        {timelineChart.length === 0 ? (
          <div className="h-full rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={Array.from({ length: 14 }, (_, i) => ({
                  label: `${i}`,
                  value: 1000 + i * 35,
                }))}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={rt.grid} strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={rt.series[3] ?? rt.grid}
                  strokeWidth={1.25}
                  strokeDasharray="4 3"
                  dot={false}
                  opacity={0.5}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={rt.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: rt.textSecondary, fontSize: 9 }}
                axisLine={{ stroke: rt.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: rt.textSecondary, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => {
                  const n = Number(v);
                  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
                  return formatUsd(n);
                }}
              />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => [formatUsd(v), "Value"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={rt.accent}
                strokeWidth={2}
                dot={{ r: 2, fill: rt.accent }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </FinancialCard>
  );
}

export function DashboardAssetPulseRow({ model }: { model: DashboardChartModel }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {model.assetCards.map((a) => (
        <AssetPulseCard key={a.label} label={a.label} pct={a.pct} color={a.color} />
      ))}
    </div>
  );
}
