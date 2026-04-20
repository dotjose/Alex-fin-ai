import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { buildPortfolioBrief } from "@/lib/briefParser";
import { useDashboardData } from "@/lib/useDashboardData";
import { LandingSection } from "./LandingSection";

function allocationRows(breakdown: Record<string, number>): {
  key: string;
  label: string;
  value: number;
}[] {
  const labels: Record<string, string> = {
    equity: "Equity",
    fixed_income: "Fixed income",
    cash: "Cash",
    alternatives: "Alternatives",
  };
  return Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export default function ProductSnapshot() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const enabled = Boolean(isLoaded && user);
  const {
    accounts,
    loading,
    error,
    totalValue,
    assetClassBreakdown,
    latestCompletedJob,
    totalPositionsCount,
  } = useDashboardData(enabled, getToken);

  return (
    <LandingSection
      id="snapshot"
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      pad="lg"
    >
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Product snapshot
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Figures below load only from your API when you are signed in. Nothing
          here is prefilled or simulated.
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        {!isLoaded ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : !user ? (
          <div className="max-w-md">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Connect your portfolio to begin analysis
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Create an account after sign-in, add positions, then run analysis
              from the dashboard. Allocation and totals appear only when your
              backend returns priced holdings.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition duration-200 hover:opacity-95"
              >
                View dashboard
              </Link>
            </div>
          </div>
        ) : loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading your portfolio data…</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : accounts.length === 0 ? (
          <div className="max-w-md">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Connect your portfolio to begin analysis
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              No accounts returned for your user yet. Add an account under{" "}
              <Link href="/dashboard#holdings" className="font-medium text-[var(--accent)] underline">
                Portfolio
              </Link>{" "}
              to pull balances and positions from the API.
            </p>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Portfolio value
              </h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
                {totalValue > 0 ? formatUsd(totalValue) : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {accounts.length} account{accounts.length === 1 ? "" : "s"},{" "}
                {totalPositionsCount} position
                {totalPositionsCount === 1 ? "" : "s"} (from API)
              </p>
              {totalValue <= 0 ? (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  No priced position values yet. When instruments include prices,
                  totals and allocation update automatically.
                </p>
              ) : null}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Allocation breakdown
              </h3>
              {totalValue <= 0 ? (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  No allocation to display until valued positions exist.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {allocationRows(assetClassBreakdown).map((row) => {
                    const pct = (row.value / totalValue) * 100;
                    return (
                      <li key={row.key}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">{row.label}</span>
                          <span className="tabular-nums text-[var(--text-primary)]">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgba(230,234,240,0.06)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Sample AI report
              </h3>
              {(() => {
                const brief = latestCompletedJob
                  ? buildPortfolioBrief(
                      latestCompletedJob.report_payload?.content,
                      latestCompletedJob.summary_payload as Record<
                        string,
                        unknown
                      >
                    )
                  : [];
                if (!brief.length) {
                  return (
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                      No completed analysis job with summary or report text yet.
                      Run analysis from the dashboard when your job queue is
                      configured.
                    </p>
                  );
                }
                return (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {brief.slice(0, 4).map((sec) => (
                      <div
                        key={sec.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                          {sec.title}
                        </h4>
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--text-secondary)] marker:text-[var(--accent)]">
                          {sec.bullets.slice(0, 3).map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </LandingSection>
  );
}
