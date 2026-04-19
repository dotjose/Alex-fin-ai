import Link from "next/link";
import { FinancialCard } from "@/components/ui/FinancialCard";
import type { ApiJob } from "@/lib/useDashboardData";
import {
  PIPELINE_LABELS,
  PIPELINE_ORDER,
  formatStepTime,
  pipelineChipClass,
  readPipeline,
} from "@/lib/analysisPipeline";

export interface AnalysisControlCardProps {
  recentFailedJob?: ApiJob | null;
  analysisRunning: boolean;
  liveJob?: ApiJob | null;
  analyzeCapability: boolean | null;
  mockLambdas?: boolean;
  analysisRunStartedAt?: number | null;
  analysisSlow: boolean;
  analysisTimedOut: boolean;
  onRunAnalysis: () => void;
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

export default function AnalysisControlCard({
  recentFailedJob = null,
  analysisRunning,
  liveJob = null,
  analyzeCapability,
  mockLambdas = false,
  analysisRunStartedAt = null,
  analysisSlow,
  analysisTimedOut,
  onRunAnalysis,
}: AnalysisControlCardProps) {
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
  const nonPendingStall =
    Boolean(showPipeline && analysisRunStartedAt) &&
    liveJob?.status != null &&
    liveJob.status !== "pending" &&
    elapsedMs > 180_000;

  return (
    <div id="portfolio-intelligence-actions">
      <FinancialCard className="mb-4" padding="md" elevation="flat">
      {recentFailedJob ? (
        <div
          className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] px-4 py-3 text-sm text-[var(--danger)]"
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
            <span className="font-mono text-[var(--text-primary)]">{recentFailedJob.id}</span>
            {recentFailedJob.created_at
              ? ` · ${new Date(recentFailedJob.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
            {analysisRunning ? "Analysis running" : "Run analysis"}
          </button>
          <Link
            href="/analysis"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[var(--accent)]"
          >
            Analysis workspace
          </Link>
        </div>
        {analyzeCapability === false ? (
          <p className="max-w-xl text-xs text-[var(--warning)]">
            Analysis is unavailable. Set{" "}
            <code className="rounded bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-1 font-mono text-[11px]">
              SQS_QUEUE_URL
            </code>{" "}
            for production, or{" "}
            <code className="rounded bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-1 font-mono text-[11px]">
              MOCK_LAMBDAS=true
            </code>{" "}
            for local in-process planner.
          </p>
        ) : null}
      </div>

      {analysisRunning && analysisSlow && !showPipeline ? (
        <p
          className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,var(--card))] px-3 py-2 text-xs text-[var(--text-primary)]"
          role="status"
        >
          Still starting the job queue. This can take a few seconds when the worker is cold.
        </p>
      ) : null}

      {analysisTimedOut ? (
        <p className="mt-4 text-xs text-[var(--danger)]" role="alert">
          Polling stopped after extended runtime. Open the analysis workspace to confirm job status.
        </p>
      ) : null}

      {showPipeline ? (
        <div
          className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-opacity duration-300 ease-out"
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
          ) : null}
          {nonPendingStall ? (
            <p
              className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] px-3 py-2 text-[12px] leading-snug text-[var(--text-primary)]"
              role="status"
            >
              No progress for over three minutes. The job is still{" "}
              <span className="font-medium">{liveJob?.status ?? "No data"}</span>. Check API and
              worker logs, SQS event source mapping, and Langfuse for the same{" "}
              <span className="font-mono text-[11px]">job_id</span>.
            </p>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Progress · job{" "}
            <span className="font-mono text-[11px] text-[var(--text-primary)]">
              {liveJob?.id ?? "No data"}
            </span>{" "}
            ·{" "}
            <span className="tabular-nums text-[var(--text-primary)]">
              {liveJob?.status ?? "No data"}
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
    </div>
  );
}
