import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiJob } from "@/lib/useDashboardData";
import { FinancialCard } from "@/components/ui/FinancialCard";
import { buildStructuredInsight, portfolioHealthFromRisk } from "@/lib/insightStructure";
import { readCachedInsight, writeCachedInsight } from "@/lib/insightSessionCache";
import InsightReportModal from "./InsightReportModal";

function jobErrorText(job: ApiJob): string {
  if (typeof job.error_message === "string" && job.error_message.trim()) {
    return job.error_message.trim();
  }
  if (typeof job.error === "string" && job.error.trim()) {
    return job.error.trim();
  }
  return "Analysis failed without a detailed message.";
}

const cellFill = "h-full min-h-0 min-w-0 overflow-hidden";

function InsightsSkeleton({ fillCell }: { fillCell?: boolean }) {
  return (
    <FinancialCard padding="md" elevation="flat" className={fillCell ? cellFill : ""}>
      <div className="h-3 w-40 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-14 animate-pulse rounded-lg bg-[var(--border)]" />
        <div className="h-14 animate-pulse rounded-lg bg-[var(--border)]" />
        <div className="h-14 animate-pulse rounded-lg bg-[var(--border)]" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded bg-[var(--border)]" />
        <div className="h-2.5 w-[90%] animate-pulse rounded bg-[var(--border)]" />
      </div>
    </FinancialCard>
  );
}

const AnalysisProgressCard = memo(function AnalysisProgressCard({
  analysisSlow,
  liveJob,
  startedAt,
  fillCell,
}: {
  analysisSlow: boolean;
  liveJob: ApiJob | null;
  startedAt: number | null;
  fillCell?: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const orch = liveJob?.request_payload?._orch?.pipeline;
  const hasOrch = orch && typeof orch === "object" && Object.keys(orch).length > 0;
  const step = hasOrch
    ? elapsed < 4000
      ? 0
      : elapsed < 12000
        ? 1
        : 2
    : elapsed < 5000
      ? 0
      : elapsed < 14000
        ? 1
        : 2;

  const steps = [
    { label: "Ingesting portfolio", desc: "Accounts, cash, positions" },
    { label: "Analyzing risk", desc: "Concentration & sleeves" },
    { label: "Generating insights", desc: "Narrative & actions" },
  ] as const;

  return (
    <FinancialCard
      padding="md"
      elevation="flat"
      className={`border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] ${fillCell ? cellFill : ""}`.trim()}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        AI pipeline
      </p>
      <p className="mt-1 text-xs text-[var(--text-primary)]">
        Non-blocking · layout stays live. Deep logs in workspace.
      </p>
      {analysisSlow ? (
        <p className="mt-2 text-[10px] text-[var(--warning)]">Extended runtime is normal for full book runs.</p>
      ) : null}
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={s.label}
              className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                active
                  ? "border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                  done
                    ? "border-[var(--success)] text-[var(--success)]"
                    : active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <p className="mt-1 font-semibold text-[var(--text-primary)]">{s.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-secondary)]">{s.desc}</p>
            </li>
          );
        })}
      </ol>
      <Link
        href={liveJob ? `/analysis?job_id=${liveJob.id}` : "/analysis"}
        className="mt-3 inline-block text-[11px] font-semibold text-[var(--accent)] transition hover:opacity-90"
      >
        Workspace →
      </Link>
    </FinancialCard>
  );
});

export interface InsightsProps {
  loading: boolean;
  job: ApiJob | null;
  /** Book-derived 0–100 risk index when the report omits a score. */
  derivedRiskScore: number;
  failedJob?: ApiJob | null;
  analysisRunning?: boolean;
  analysisSlow?: boolean;
  liveJob?: ApiJob | null;
  analysisRunStartedAt?: number | null;
  /** Fill dashboard grid cell without overflow. */
  fillCell?: boolean;
  /** Max bullets in the completed summary (default 3). */
  previewBulletMax?: number;
  /** Hide tag chips for a calmer portfolio rail. */
  hideInsightChips?: boolean;
}

export default function Insights({
  loading,
  job,
  derivedRiskScore,
  failedJob = null,
  analysisRunning = false,
  analysisSlow = false,
  liveJob = null,
  analysisRunStartedAt = null,
  fillCell = false,
  previewBulletMax = 3,
  hideInsightChips = false,
}: InsightsProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportMd, setReportMd] = useState("");
  const [cached, setCached] = useState<ReturnType<typeof readCachedInsight>>(null);
  const cacheWrittenForJob = useRef<string | null>(null);

  const openReport = useCallback((title: string, markdown: string) => {
    setReportTitle(title);
    setReportMd(markdown);
    setReportOpen(true);
  }, []);

  const closeReport = useCallback(() => {
    setReportOpen(false);
  }, []);

  useEffect(() => {
    setCached(readCachedInsight());
  }, [job?.id, loading]);

  const completed = Boolean(job && job.status === "completed");

  const structured = useMemo(() => {
    if (!completed || !job) return null;
    return buildStructuredInsight(job);
  }, [completed, job]);

  useEffect(() => {
    if (!job) {
      cacheWrittenForJob.current = null;
      return;
    }
    if (job.status !== "completed") return;
    if (cacheWrittenForJob.current === job.id) return;
    cacheWrittenForJob.current = job.id;
    const s = buildStructuredInsight(job);
    writeCachedInsight({
      jobId: job.id,
      completedAt: job.completed_at,
      snapshotTitle: s.title,
      snapshotBullets: s.bullets.slice(0, 5),
      fullMarkdown: s.fullMarkdown,
    });
    setCached(readCachedInsight());
  }, [job?.id, job?.status]);

  const reportModal = (
    <InsightReportModal
      open={reportOpen}
      onClose={closeReport}
      title={reportTitle}
      markdown={reportMd}
    />
  );

  if (loading) {
    return (
      <>
        <InsightsSkeleton fillCell={fillCell} />
        {reportModal}
      </>
    );
  }

  if (analysisRunning) {
    return (
      <>
        <AnalysisProgressCard
          analysisSlow={analysisSlow}
          liveJob={liveJob}
          startedAt={analysisRunStartedAt ?? null}
          fillCell={fillCell}
        />
        {reportModal}
      </>
    );
  }

  if (!completed) {
    const useCache = Boolean(cached && cached.snapshotBullets.length > 0);
    return (
      <>
        <FinancialCard padding="md" elevation="flat" className={fillCell ? cellFill : ""}>
          {failedJob ? (
            <div
              className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--card))] px-3 py-2 text-xs"
              role="status"
            >
              <p className="font-semibold text-[var(--text-primary)]">Job failed</p>
              <p className="mt-1 line-clamp-3 text-[var(--text-secondary)]">{jobErrorText(failedJob)}</p>
              <Link
                href={`/analysis?job_id=${failedJob.id}`}
                className="mt-2 inline-block text-[11px] font-semibold text-[var(--accent)]"
              >
                Inspect →
              </Link>
            </div>
          ) : null}

          {useCache && cached ? (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Cached session insight
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{cached.snapshotTitle}</p>
              <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-secondary)]">
                {cached.snapshotBullets.slice(0, 3).map((b, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[var(--accent)]">·</span>
                    <span className="line-clamp-2">{b}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => openReport(cached.snapshotTitle, cached.fullMarkdown)}
                className="mt-2 text-[11px] font-semibold text-[var(--accent)]"
              >
                View full analysis
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                AI intelligence
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">Run portfolio analysis</p>
            </div>
            <Link
              href="#portfolio-intelligence-actions"
              className="rounded-md border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] transition hover:opacity-90"
            >
              Go to controls
            </Link>
          </div>
          <Link
            href="/analysis"
            className="mt-3 inline-block text-[11px] font-semibold text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)]"
          >
            Open workspace
          </Link>
        </FinancialCard>
        {reportModal}
      </>
    );
  }

  if (!job || !structured) {
    return (
      <>
        <FinancialCard padding="md" elevation="flat" className={fillCell ? cellFill : ""}>
          <p className="text-xs text-[var(--text-secondary)]">Payload incomplete for structured view.</p>
          {job ? (
            <Link
              href={`/analysis?job_id=${job.id}`}
              className="mt-2 inline-block text-[11px] font-semibold text-[var(--accent)]"
            >
              Workspace →
            </Link>
          ) : null}
        </FinancialCard>
        {reportModal}
      </>
    );
  }

  const extractedRisk = structured.riskScore;
  const hasExtracted = extractedRisk != null && Number.isFinite(extractedRisk);
  const displayRisk = hasExtracted ? Math.round(Number(extractedRisk)) : derivedRiskScore;
  const displayHealth = portfolioHealthFromRisk(displayRisk);

  const previewBullets = structured.bullets.slice(0, previewBulletMax);
  const insightChips = hideInsightChips ? [] : structured.chips.slice(0, 4);

  return (
    <>
      <FinancialCard
        padding="md"
        elevation="flat"
        className={`border-[var(--border)] ${fillCell ? cellFill : ""}`.trim()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              AI intelligence
            </p>
            <h3 className="ds-h3 mt-0.5 line-clamp-2">{structured.title}</h3>
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Risk
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text-primary)]">{displayRisk}</p>
              <p className="text-[9px] text-[var(--text-secondary)]">/100</p>
              {!hasExtracted ? (
                <p className="mt-0.5 text-[8px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  Book
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Health
              </p>
              {displayHealth.kind === "pending" ? (
                <p className="mt-1 text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Pending</p>
              ) : (
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--accent)]">{displayHealth.letter}</p>
              )}
            </div>
          </div>
        </div>

        {insightChips.length > 0 ? (
          <div className="mt-3 flex min-h-[28px] flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
            {insightChips.map((c, i) => (
              <span
                key={`${i}-${c.slice(0, 32)}`}
                className="max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]"
                title={c}
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {previewBullets.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
            {previewBullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-[var(--text-secondary)]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Open full analysis for narrative detail.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openReport(structured.title, structured.fullMarkdown)}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-on-accent)] transition hover:opacity-95"
          >
            View full analysis
          </button>
          <Link
            href={`/analysis?job_id=${job.id}`}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]"
          >
            Workspace
          </Link>
        </div>
      </FinancialCard>
      {reportModal}
    </>
  );
}
