"use client";

import { memo } from "react";
import { BarChart3, PlusCircle, Wallet } from "lucide-react";

export type ActionBarProps = {
  onRunAnalysis: () => void;
  onAddPosition: () => void;
  onAddAccount: () => void;
  analysisRunning: boolean;
  analyzeDisabled?: boolean;
  analyzeDisabledReason?: string;
};

export const ActionBar = memo(function ActionBar({
  onRunAnalysis,
  onAddPosition,
  onAddAccount,
  analysisRunning,
  analyzeDisabled,
  analyzeDisabledReason,
}: ActionBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400 sm:hidden">Actions</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={Boolean(analyzeDisabled) || analysisRunning}
          title={analyzeDisabledReason}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:flex-none"
        >
          <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
          {analysisRunning ? "Analysis running…" : "Run analysis"}
        </button>
        <button
          type="button"
          onClick={onAddPosition}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800 sm:flex-none"
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
          Add position
        </button>
        <button
          type="button"
          onClick={onAddAccount}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800 sm:flex-none"
        >
          <Wallet className="h-4 w-4 shrink-0" aria-hidden />
          Add account
        </button>
      </div>
      {analyzeDisabled && analyzeDisabledReason ? (
        <p className="max-w-md text-right text-[11px] text-amber-700 dark:text-amber-300/90">{analyzeDisabledReason}</p>
      ) : null}
    </div>
  );
});
