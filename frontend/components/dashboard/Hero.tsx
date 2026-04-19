import Link from "next/link";
import { FinancialCard, EmptyState } from "@/components/ui/FinancialCard";
import { formatUsd } from "@/lib/format";
import type { ApiJob } from "@/lib/useDashboardData";
import {
  PIPELINE_LABELS,
  PIPELINE_ORDER,
  formatStepTime,
  pipelineChipClass,
  readPipeline,
} from "@/lib/analysisPipeline";
import { useRechartsTheme } from "@/lib/useRechartsTheme";

export interface HeroProps {
  loading: boolean;
  accountCount: number;
  totalPortfolioValue: number;
  assetClassBreakdown: Record<string, number>;
  lastAnalysisLabel: string | null;
  analysisRunning: boolean;
  liveJob?: ApiJob | null;
  recentFailedJob?: ApiJob | null;
  analyzeCapability: boolean | null;
  /** API is using in-process planner (MOCK_LAMBDAS), not only SQS */
  mockLambdas?: boolean;
  /** When current run started (ms); used for long-run hint */
  analysisRunStartedAt?: number | null;
  onRunAnalysis: () => void;
}

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AllocationStrip({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  const rt = useRechartsTheme();
  if (total <= 0) return null;
  const rows = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          Allocation
        </p>
        <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">
          By asset class (API weights)
        </p>
      </div>
      <div
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_55%,var(--card))]"
        role="img"
        aria-label="Portfolio allocation by asset class"
      >
        {rows.map(([key, value], i) => {
          const pct = Math.min(100, (value / total) * 100);
          return (
            <div
              key={key}
              className="h-full min-w-[2px] transition-[flex-grow] duration-300 ease-out"
              style={{
                flex: `${pct} 1 0%`,
                backgroundColor: rt.series[i % rt.series.length],
              }}
              title={`${formatLabel(key)}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--text-secondary)]">
        {rows.map(([key, value], i) => {
          const pct = (value / total) * 100;
          return (
            <li key={key} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{
                  backgroundColor: rt.series[i % rt.series.length],
                }}
              />
              <span className="text-[var(--text-primary)]">{formatLabel(key)}</span>
              <span className="tabular-nums">{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <FinancialCard className="mb-10">
      <div className="animate-pulse space-y-6">
        <div className="h-3 w-40 rounded bg-[var(--border)]" />
        <div className="h-12 w-64 max-w-full rounded bg-[var(--border)]" />
        <div className="flex flex-wrap gap-6">
          <div className="h-9 w-28 rounded bg-[var(--border)]" />
          <div className="h-9 w-36 rounded bg-[var(--border)]" />
        </div>
        <div className="h-11 w-44 rounded-lg bg-[var(--border)]" />
      </div>
    </FinancialCard>
  );
}

function jobErrorText(job: ApiJob): string {
  if (typeof job.error_message === "string" && job.error_message.trim()) {
    return job.error_message.trim();
  }
  if (typeof job.error === "string" && job.error.trim()) {
    return job.error.trim();
  }
  return "Analysis failed without a detailed message. Check the analysis workspace for job logs.";
}

export default function Hero({
  loading,
  accountCount,
  totalPortfolioValue,
  assetClassBreakdown,
  lastAnalysisLabel,
  analysisRunning,
  liveJob = null,
  recentFailedJob = null,
  analyzeCapability,
  mockLambdas = false,
  analysisRunStartedAt = null,
  onRunAnalysis,
}: HeroProps) {
  if (loading) {
    return <HeroSkeleton />;
  }

  if (accountCount === 0) {
    return (
      <FinancialCard className="mb-10">
        <EmptyState
          title="No accounts yet"
          description="Add an account to load balances and positions from the API. The dashboard only shows data returned for your user."
          actionLabel="Connect account / Add portfolio"
          actionHref="/accounts"
        />
      </FinancialCard>
    );
  }

  const pipeline = readPipeline(liveJob ?? undefined);
  const showPipeline = analysisRunning && liveJob;
  const elapsedMs =
    showPipeline && analysisRunStartedAt
      ? Date.now() - (analysisRunStartedAt as number)
      : 0;
  const pendingDelayed =
    Boolean(showPipeline && analysisRunStartedAt) &&
    liveJob?.status === "pending" &&
    elapsedMs > 30_000;
  const pendingSqsRetryHint = pendingDelayed && elapsedMs > 180_000;
  // Wall clock since "Run analysis" — long single steps (e.g. reporter + judge) often exceed 60s
  // without any orch JSON change, so avoid alarming until three minutes.
  const nonPendingStall =
    Boolean(showPipeline && analysisRunStartedAt) &&
    liveJob?.status != null &&
    liveJob.status !== "pending" &&
    elapsedMs > 180_000;

  return (
    <FinancialCard className="mb-10">
      {recentFailedJob ? (
        <div
          className="mb-8 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] px-4 py-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          <p className="font-medium text-[var(--text-primary)]">
            Latest analysis did not complete
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {jobErrorText(recentFailedJob)}
          </p>
          <p className="mt-2 text-[11px] tabular-nums text-[var(--text-secondary)]">
            Job{" "}
            <span className="font-mono text-[var(--text-primary)]">
              {recentFailedJob.id}
            </span>
            {recentFailedJob.created_at
              ? ` · ${new Date(recentFailedJob.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            Portfolio
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Total value
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-4xl">
                {formatUsd(totalPortfolioValue)}
              </p>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]"
                title="Snapshot from linked accounts and prices"
                aria-hidden
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-[var(--accent)]"
                >
                  <path
                    d="M5 15l4-4 3 3 5-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 19h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  Session change
                </p>
                <p className="text-sm font-medium tabular-nums text-[var(--text-secondary)]">
                  —
                </p>
              </div>
            </div>
          </div>
          <AllocationStrip breakdown={assetClassBreakdown} total={totalPortfolioValue} />
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={analysisRunning || analyzeCapability !== true}
            title={
              analyzeCapability === true
                ? undefined
                : mockLambdas
                  ? "API should allow analysis via MOCK_LAMBDAS; if disabled, check server env."
                  : "The API is not configured with SQS_QUEUE_URL or MOCK_LAMBDAS, so analysis cannot run."
            }
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {analysisRunning ? "Analysis in progress…" : "Run analysis"}
          </button>
          {analyzeCapability === false ? (
            <p className="max-w-md text-xs text-[var(--warning)]">
              Analysis is unavailable. Set{" "}
              <code className="rounded bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-1 font-mono text-[11px]">
                SQS_QUEUE_URL
              </code>{" "}
              for production, or{" "}
              <code className="rounded bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-1 font-mono text-[11px]">
                MOCK_LAMBDAS=true
              </code>{" "}
              for local in-process planner (child agents still need reachable Lambdas).
            </p>
          ) : null}
          <Link
            href="/analysis"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[var(--accent)]"
          >
            View reports
          </Link>
        </div>
      </div>

      <dl className="mt-10 grid gap-8 border-t border-[var(--border)] pt-10 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-[var(--text-secondary)]">Accounts</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {accountCount}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--text-secondary)]">Last analysis</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {lastAnalysisLabel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--text-secondary)]">Data source</dt>
          <dd className="mt-1 text-sm leading-snug text-[var(--text-primary)]">
            Linked accounts &amp; positions from your API
          </dd>
        </div>
      </dl>

      {showPipeline ? (
        <div
          className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-opacity duration-300 ease-out"
          aria-live="polite"
        >
          {pendingDelayed ? (
            <p
              className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] px-3 py-2 text-[12px] leading-snug text-[var(--text-primary)]"
              role="status"
            >
              Delayed (processing in queue).
              {pendingSqsRetryHint ? (
                <span className="mt-2 block text-[var(--text-secondary)]">
                  System is retrying execution via SQS.
                </span>
              ) : null}
            </p>
          ) : nonPendingStall ? (
            <p
              className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] px-3 py-2 text-[12px] leading-snug text-[var(--text-primary)]"
              role="status"
            >
              No progress for over three minutes. The job is still{" "}
              <span className="font-medium">{liveJob?.status ?? "—"}</span>. Check API and
              worker logs, SQS event source mapping, and Langfuse for the same{" "}
              <span className="font-mono text-[11px]">job_id</span>.
            </p>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Progress · job{" "}
            <span className="font-mono text-[11px] text-[var(--text-primary)]">
              {liveJob?.id ?? "—"}
            </span>{" "}
            ·{" "}
            <span className="tabular-nums text-[var(--text-primary)]">
              {liveJob?.status ?? "—"}
            </span>
          </p>
          <ul className="mt-3 space-y-2">
            {PIPELINE_ORDER.map((key) => {
              const step = pipeline[key];
              const status = step?.status ?? "pending";
              const label = PIPELINE_LABELS[key];
              const t = formatStepTime(step?.at);
              const errHint = step?.error || step?.detail;
              const done = status === "completed";
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors duration-200"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2.5 font-medium leading-snug">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                        done
                          ? "border-[color-mix(in_srgb,var(--success)_50%,var(--border))] bg-[color-mix(in_srgb,var(--success)_12%,var(--card))] text-[var(--success)]"
                          : "border-[var(--border)] text-[var(--text-secondary)]"
                      }`}
                      aria-hidden
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className="min-w-0">{label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {t ? (
                      <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {t}
                      </span>
                    ) : null}
                    <span
                      className={pipelineChipClass(status)}
                      title={errHint ? String(errHint) : undefined}
                    >
                      {status === "pending"
                        ? "Waiting"
                        : status === "running" || status === "queued"
                          ? "Running"
                          : status === "completed"
                            ? "Completed"
                            : status === "failed"
                              ? "Failed"
                              : status}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </FinancialCard>
  );
}
