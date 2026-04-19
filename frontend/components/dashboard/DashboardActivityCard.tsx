import Link from "next/link";
import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { ApiJob } from "@/lib/useDashboardData";
import { FinancialCard } from "@/components/ui/FinancialCard";
import { formatDataFreshness } from "@/lib/dashboardFreshness";

export type DashboardActivityCardProps = {
  loading: boolean;
  jobs: ApiJob[];
};

function statusClass(status: string): string {
  if (status === "completed") return "text-[var(--success)]";
  if (status === "failed") return "text-[var(--danger)]";
  if (status === "running" || status === "pending") return "text-[var(--accent)]";
  return "text-[var(--text-secondary)]";
}

export function DashboardActivityCard({ loading, jobs }: DashboardActivityCardProps) {
  const rows = useMemo(() => {
    return [...jobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [jobs]);

  if (loading) {
    return (
      <FinancialCard padding="md" elevation="flat" className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden">
        <div className="h-4 w-28 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-[10px] bg-[var(--border)]" />
          ))}
        </div>
      </FinancialCard>
    );
  }

  return (
    <FinancialCard padding="md" elevation="flat" className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Activity className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p className="ds-caption normal-case tracking-normal text-[var(--text-secondary)]">Activity</p>
          <p className="ds-h3 mt-0.5">Recent jobs</p>
        </div>
      </div>
      <ul className="mt-[var(--space-4)] min-h-0 flex-1 space-y-[var(--space-2)] overflow-y-auto overflow-x-hidden">
        {rows.length === 0 ? (
          <li className="ds-body text-[var(--text-secondary)]">No runs yet.</li>
        ) : (
          rows.map((j) => (
            <li key={j.id} className="min-w-0">
              <Link
                href={`/analysis?job_id=${j.id}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-[10px] border border-transparent px-2 py-2 transition hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
              >
                <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {j.job_type || "Analysis"}
                </span>
                <span className={`shrink-0 text-[11px] font-semibold uppercase ${statusClass(j.status)}`}>
                  {j.status}
                </span>
              </Link>
              <p className="truncate pl-2 text-[11px] text-[var(--text-secondary)]">
                {formatDataFreshness(new Date(j.created_at))}
              </p>
            </li>
          ))
        )}
      </ul>
    </FinancialCard>
  );
}
