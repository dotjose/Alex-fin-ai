"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { Building2, Activity } from "lucide-react";
import type { ApiAccount, ApiJob, ApiPortfolioSnapshot, ApiPosition } from "@/lib/useDashboardData";
import { formatUsdDetailed, toNumber } from "@/lib/format";
import { formatDataFreshness } from "@/lib/dashboardFreshness";

export type SecondaryStripProps = {
  loading: boolean;
  accounts: ApiAccount[];
  portfolioByAccount: Record<string, ApiPortfolioSnapshot>;
  positionsByAccount: Record<string, ApiPosition[]>;
  jobs: ApiJob[];
};

function jobStatusClass(status: string): string {
  if (status === "completed") return "text-emerald-600 dark:text-emerald-400";
  if (status === "failed") return "text-rose-600 dark:text-rose-400";
  if (status === "running" || status === "pending") return "text-sky-600 dark:text-sky-400";
  return "text-gray-500 dark:text-gray-400";
}

export const SecondaryStrip = memo(function SecondaryStrip({
  loading,
  accounts,
  portfolioByAccount,
  positionsByAccount,
  jobs,
}: SecondaryStripProps) {
  const activityRows = useMemo(() => {
    return [...jobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [jobs]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
        <div className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Accounts</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Summary</p>
          </div>
        </div>
        {accounts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">No accounts on file yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {accounts.map((a) => {
              const snap = portfolioByAccount[a.id];
              const tv = snap?.total_value ?? toNumber(a.cash_balance);
              const n = (positionsByAccount[a.id] ?? []).length;
              const label = a.account_name?.trim() || "Account";
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {n} position{n === 1 ? "" : "s"}
                      {snap ? "" : " · book pending"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatUsdDetailed(tv)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Activity</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent jobs</p>
          </div>
        </div>
        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
          {activityRows.length === 0 ? (
            <li className="text-sm text-gray-600 dark:text-gray-400">No runs yet.</li>
          ) : (
            activityRows.map((j) => (
              <li key={j.id} className="min-w-0">
                <Link
                  href={`/analysis?job_id=${j.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-transparent px-2 py-2 transition hover:border-gray-200 hover:bg-gray-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/80"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {j.job_type || "Analysis"}
                  </span>
                  <span className={`shrink-0 text-[11px] font-semibold uppercase ${jobStatusClass(j.status)}`}>
                    {j.status}
                  </span>
                </Link>
                <p className="truncate pl-2 text-[11px] text-gray-500 dark:text-gray-400">
                  {formatDataFreshness(new Date(j.created_at))}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
});
