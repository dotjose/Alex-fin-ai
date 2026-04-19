import Link from "next/link";
import type { ApiJob } from "@/lib/useDashboardData";
import { FinancialCard, EmptyState } from "@/components/ui/FinancialCard";
import { buildPortfolioBrief } from "@/lib/briefParser";

function jobErrorText(job: ApiJob): string {
  if (typeof job.error_message === "string" && job.error_message.trim()) {
    return job.error_message.trim();
  }
  if (typeof job.error === "string" && job.error.trim()) {
    return job.error.trim();
  }
  return "Analysis failed without a detailed message.";
}

function InsightsSkeleton() {
  return (
    <FinancialCard>
      <div className="h-3 w-36 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]" />
        <div className="h-3 w-[85%] animate-pulse rounded bg-[var(--border)]" />
        <div className="h-3 w-[70%] animate-pulse rounded bg-[var(--border)]" />
      </div>
    </FinancialCard>
  );
}

export interface InsightsProps {
  loading: boolean;
  job: ApiJob | null;
  failedJob?: ApiJob | null;
}

export default function Insights({ loading, job, failedJob = null }: InsightsProps) {
  if (loading) {
    return <InsightsSkeleton />;
  }

  const completed = job && job.status === "completed";

  if (!completed) {
    return (
      <FinancialCard>
        {failedJob ? (
          <div
            className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] px-4 py-3 text-sm"
            role="status"
          >
            <p className="font-medium text-[var(--text-primary)]">Recent job failed</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {jobErrorText(failedJob)}
            </p>
            <p className="mt-2 text-[11px] tabular-nums text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--text-primary)]">{failedJob.id}</span>
              {failedJob.created_at
                ? ` · ${new Date(failedJob.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : null}
            </p>
            <Link
              href={`/analysis?job_id=${failedJob.id}`}
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)] transition hover:opacity-90"
            >
              Inspect job in workspace →
            </Link>
          </div>
        ) : null}
        <EmptyState
          title="No completed analysis yet"
          description="When a job finishes with status completed, summary and report text from the API appear here. Use Run analysis in the summary card once you have accounts and positions."
        />
        <div className="mt-6">
          <Link
            href="/analysis"
            className="text-sm font-medium text-[var(--accent)] transition hover:opacity-90"
          >
            Open analysis workspace →
          </Link>
        </div>
      </FinancialCard>
    );
  }

  const reportMd = job.report_payload?.content?.trim();
  const sections = buildPortfolioBrief(
    reportMd,
    job.summary_payload as Record<string, unknown> | undefined
  );
  const hasText = sections.length > 0;

  return (
    <FinancialCard>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          AI Portfolio Brief
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          From your most recent completed job
        </p>
      </div>

      {!hasText ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          This job completed without narrative fields in the payload. Open the
          analysis workspace for charts and other data if the API stored them.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {sections.map((sec) => (
            <div
              key={sec.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {sec.title}
              </h4>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-[var(--text-secondary)] marker:text-[var(--accent)]">
                {sec.bullets.map((b, i) => (
                  <li key={i} className="pl-0.5">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/analysis?job_id=${job.id}`}
          className="text-sm font-medium text-[var(--accent)] transition hover:opacity-90"
        >
          Open full analysis →
        </Link>
      </div>
    </FinancialCard>
  );
}
