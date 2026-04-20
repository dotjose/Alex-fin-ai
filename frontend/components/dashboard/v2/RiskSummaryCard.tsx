"use client";

import { memo } from "react";
import { Shield } from "lucide-react";
import type { RiskBadge, RiskBadgeVariant } from "@/lib/dashboardRiskBadge";

export type RiskSummaryCardProps = {
  riskScore: number | null;
  riskBadge: RiskBadge;
  loading: boolean;
};

function riskBlurb(variant: RiskBadgeVariant): string {
  if (variant === "warn") return "Consider diversification and concentration limits for your goals.";
  if (variant === "accent") return "Elevated concentration — review sleeves before sizing new risk.";
  return "Heuristic posture from current allocation — not personalized advice.";
}

export const RiskSummaryCard = memo(function RiskSummaryCard({
  riskScore,
  riskBadge,
  loading,
}: RiskSummaryCardProps) {
  if (loading) {
    return (
      <div className="h-[200px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900" />
    );
  }

  const score = riskScore != null && Number.isFinite(riskScore) ? Math.round(riskScore) : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          <Shield className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Risk</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <p className="text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-50">{score ?? "—"}</p>
            <span className="mb-1 text-sm text-gray-500 dark:text-gray-400">/ 100</span>
            <span className="mb-1.5 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200">
              {riskBadge.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {riskBlurb(riskBadge.variant)}
          </p>
        </div>
      </div>
    </div>
  );
});
