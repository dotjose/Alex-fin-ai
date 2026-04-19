import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { FinancialCard } from "@/components/ui/FinancialCard";
import type { ApiInstrument, ApiJob, ApiPosition } from "@/lib/useDashboardData";
import {
  allocationDriftRows,
  analysisCadenceSeries,
  sectorExposureRows,
} from "@/lib/dashboardChartData";
import { parseOverweightHints, rowMatchesNarrativeHint } from "@/lib/narrativeHints";
import { useRechartsTheme } from "@/lib/useRechartsTheme";

type Profile = Record<string, unknown> | null;

function pickTargets(profile: Profile): { equity?: number; fixed_income?: number } | null {
  if (!profile || typeof profile !== "object") return null;
  const raw = profile.asset_class_targets as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  return {
    equity: typeof raw.equity === "number" ? raw.equity : undefined,
    fixed_income:
      typeof raw.fixed_income === "number" ? raw.fixed_income : undefined,
  };
}

function buildNarrative(job: ApiJob | null | undefined): string {
  if (!job) return "";
  const parts: string[] = [];
  const c = job.report_payload?.content;
  if (typeof c === "string" && c.trim()) parts.push(c);
  const s = job.summary_payload as Record<string, unknown> | undefined;
  if (s) {
    for (const v of Object.values(s)) {
      if (typeof v === "string" && v.trim()) parts.push(v);
    }
  }
  return parts.join("\n");
}

export interface InstitutionalDashboardChartsProps {
  loading: boolean;
  jobs: ApiJob[];
  positionsByAccount: Record<string, ApiPosition[]>;
  instruments: Record<string, ApiInstrument>;
  assetClassBreakdown: Record<string, number>;
  totalValue: number;
  profile: Profile;
  latestCompletedJob: ApiJob | null;
}

export default function InstitutionalDashboardCharts({
  loading,
  jobs,
  positionsByAccount,
  instruments,
  assetClassBreakdown,
  totalValue,
  profile,
  latestCompletedJob,
}: InstitutionalDashboardChartsProps) {
  const rt = useRechartsTheme();
  const narrative = useMemo(
    () => buildNarrative(latestCompletedJob ?? undefined),
    [latestCompletedJob]
  );
  const hints = useMemo(() => parseOverweightHints(narrative), [narrative]);

  const sectorRows = useMemo(
    () => sectorExposureRows(positionsByAccount, instruments),
    [positionsByAccount, instruments]
  );

  const driftRows = useMemo(
    () =>
      allocationDriftRows(
        assetClassBreakdown,
        totalValue,
        pickTargets(profile)
      ),
    [assetClassBreakdown, totalValue, profile]
  );

  const cadence = useMemo(() => analysisCadenceSeries(jobs), [jobs]);

  const commonAxis = {
    stroke: rt.grid,
    vertical: false,
  };

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--text-primary)",
  };

  if (loading) {
    return (
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <FinancialCard key={i} className="animate-pulse">
            <div className="h-4 w-32 rounded bg-[var(--border)]" />
            <div className="mt-6 h-48 rounded-lg bg-[var(--border)]" />
          </FinancialCard>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-3">
      <FinancialCard>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Analysis cadence
        </h3>
        <p className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">
          Cumulative completed jobs (NAV history requires your data provider).
        </p>
        <div className="mt-4 h-52 w-full min-h-[208px]">
          {cadence.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No completed analyses yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cadence} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke={rt.grid}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={{ stroke: rt.grid }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  width={28}
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke={rt.accent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: rt.accent }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </FinancialCard>

      <FinancialCard>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Exposure by instrument type
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {hints.length
            ? "Highlighted when narrative suggests concentration in that bucket."
            : "From instrument metadata on your positions."}
        </p>
        <div className="mt-4 h-52 w-full min-h-[208px]">
          {sectorRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No valued positions with instrument type.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectorRows.slice(0, 8)}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  stroke={rt.grid}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={{ stroke: rt.grid }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {sectorRows.slice(0, 8).map((row, i) => (
                    <Cell
                      key={row.name}
                      fill={
                        rowMatchesNarrativeHint(row.name, hints)
                          ? rt.highlight
                          : rt.series[i % rt.series.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </FinancialCard>

      <FinancialCard>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Allocation drift
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Actual vs profile targets (equity / fixed income), percentage points.
        </p>
        <div className="mt-4 h-52 w-full min-h-[208px]">
          {driftRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              Set targets under Settings to see drift vs current allocation.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driftRows} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" {...commonAxis} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={{ stroke: rt.grid }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: rt.textSecondary, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}pp`}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {driftRows.map((row, i) => (
                    <Cell
                      key={row.name}
                      fill={
                        row.value > 0
                          ? rt.warning
                          : row.value < 0
                            ? rt.accent
                            : rt.series[i % rt.series.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </FinancialCard>
    </div>
  );
}
