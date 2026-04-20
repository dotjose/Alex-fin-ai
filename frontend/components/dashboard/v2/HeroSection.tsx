"use client";

import { memo } from "react";
import { formatUsdDetailed } from "@/lib/format";

export type HeroSectionProps = {
  displayName: string | null;
  totalValue: number;
  /** Percent change vs prior timeline point, if known */
  dailyChangePct: number | null;
  portfolioScore: number | null;
  loading: boolean;
};

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) {
    return (
      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400">
        No prior snapshot
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
        up
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
      }`}
    >
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

export const HeroSection = memo(function HeroSection({
  displayName,
  totalValue,
  dailyChangePct,
  portfolioScore,
  loading,
}: HeroSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            Portfolio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
            {displayName ? `Hi, ${displayName}` : "Your portfolio"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Live marks, allocation, and AI context — optimized for decision clarity.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Net value
            </p>
            {loading ? (
              <div className="mt-2 h-10 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800" />
            ) : (
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
                {formatUsdDetailed(totalValue)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">vs last analysis point</span>
              <DeltaBadge pct={dailyChangePct} />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Portfolio score
            </p>
            {loading ? (
              <div className="mt-2 h-9 w-16 animate-pulse rounded-md bg-gray-200 dark:bg-neutral-800" />
            ) : (
              <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {portfolioScore != null && Number.isFinite(portfolioScore) ? Math.round(portfolioScore) : "—"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-500">Book-based risk index · 0–100</p>
          </div>
        </div>
      </div>
    </section>
  );
});
