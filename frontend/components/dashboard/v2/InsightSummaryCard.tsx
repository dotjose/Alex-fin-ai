"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { buildStructuredInsight } from "@/lib/insightStructure";
import { formatUsd, toNumber } from "@/lib/format";
import type { ApiAccount, ApiJob, ApiPortfolioSnapshot } from "@/lib/useDashboardData";

export type InsightSummaryCardProps = {
  job: ApiJob | null;
  loading: boolean;
  accounts: ApiAccount[];
  portfolioByAccount: Record<string, ApiPortfolioSnapshot>;
};

function cashShare(accounts: ApiAccount[], portfolioByAccount: Record<string, ApiPortfolioSnapshot>) {
  let cash = 0;
  let total = 0;
  for (const a of accounts) {
    const s = portfolioByAccount[a.id];
    if (s) {
      cash += s.cash_balance;
      total += s.total_value;
    } else {
      const c = toNumber(a.cash_balance);
      cash += c;
      total += c;
    }
  }
  if (total <= 0) return null;
  return (100 * cash) / total;
}

function EmptyInsight() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI insight</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Run an analysis to generate a concise brief and next actions for this portfolio.
          </p>
          <Link
            href="/analysis"
            className="mt-4 inline-flex rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
          >
            Open workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

export const InsightSummaryCard = memo(function InsightSummaryCard({
  job,
  loading,
  accounts,
  portfolioByAccount,
}: InsightSummaryCardProps) {
  const structured = useMemo(() => {
    if (!job || job.status !== "completed") return null;
    return buildStructuredInsight(job);
  }, [job]);

  const cashPct = useMemo(
    () => (accounts.length ? cashShare(accounts, portfolioByAccount) : null),
    [accounts, portfolioByAccount],
  );

  const cashHeuristic = useMemo(() => {
    if (cashPct == null || !Number.isFinite(cashPct) || cashPct < 70) return null;
    const excess = accounts.reduce((s, a) => s + toNumber(a.cash_balance), 0);
    const deployHint =
      excess > 2500
        ? `Consider allocating ${formatUsd(Math.min(excess * 0.15, excess))} into diversified ETFs when ready.`
        : "Consider gradual deployment into diversified ETFs when ready.";
    return {
      headline: `You are holding about ${cashPct.toFixed(0)}% in cash`,
      context: "Idle cash can drag long-term expected returns versus your policy benchmark.",
      suggestion: deployHint,
      ctaHref: "/analysis" as const,
      ctaLabel: "Review allocation" as const,
    };
  }, [cashPct, accounts]);

  if (loading) {
    return (
      <div className="min-h-[220px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
    );
  }

  if (structured && job?.id) {
    const headline =
      structured.title.length > 72 ? `${structured.title.slice(0, 72)}…` : structured.title;
    const primaryBullet = structured.bullets[0] ?? "Open the analysis workspace for the full brief.";
    const suggestion =
      structured.bullets[1] ?? structured.chips[0] ?? "Use the workspace to stress-test scenarios and sleeves.";

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">AI insight</p>
            <p className="mt-1 text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{primaryBullet}</p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              {suggestion}
            </p>
            <div className="mt-4">
              <Link
                href={`/analysis?job_id=${job.id}`}
                className="inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                View full analysis
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cashHeuristic) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">AI insight</p>
            <p className="mt-1 text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {cashHeuristic.headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{cashHeuristic.context}</p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              {cashHeuristic.suggestion}
            </p>
            <div className="mt-4">
              <Link
                href={cashHeuristic.ctaHref}
                className="inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {cashHeuristic.ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <EmptyInsight />;
});
