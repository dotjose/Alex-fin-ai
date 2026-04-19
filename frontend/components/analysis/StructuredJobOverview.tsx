import { useMemo, useState } from "react";
import {
  buildStructuredInsight,
  formatPortfolioValueFromJob,
  type StructuredInsight,
} from "@/lib/insightStructure";
import { severityFromInsightText, type InsightSeverity } from "@/lib/insightSeverity";
import type { ApiJob } from "@/lib/useDashboardData";
import {
  DsBadge,
  DsCard,
  DsMetricTile,
  DsSectionHeader,
  ReportModal,
} from "@/components/ds";

function oneSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const dot = t.indexOf(".");
  if (dot > 0 && dot <= 220) return t.slice(0, dot + 1);
  return t.length > 220 ? `${t.slice(0, 217)}…` : t;
}

function healthLabel(health: StructuredInsight["health"]): string {
  if (health.kind === "pending") return "Risk pending";
  return `Health ${health.letter}`;
}

function severityVariant(s: InsightSeverity): "neutral" | "warn" | "danger" {
  if (s === "high") return "danger";
  if (s === "medium") return "warn";
  return "neutral";
}

type InsightRow = {
  id: string;
  title: string;
  body: string;
  severity: InsightSeverity;
};

type Props = {
  job: ApiJob;
};

const FILTER_LABELS: { id: "all" | InsightSeverity; label: string }[] = [
  { id: "all", label: "All" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/**
 * Portfolio overview: summary metrics, bounded insight cards with severity, filterable chips, full markdown in modal only.
 */
export function StructuredJobOverview({ job }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"all" | InsightSeverity>("all");
  const insight = useMemo(() => buildStructuredInsight(job), [job]);
  const portfolio = formatPortfolioValueFromJob(job);
  const keyInsight =
    oneSentence(insight.bullets[0] ?? insight.sections[0]?.bullets[0] ?? "") ||
    "Open the full report for narrative detail.";

  const insightRows: InsightRow[] = useMemo(() => {
    return insight.bullets.slice(0, 5).map((text, i) => ({
      id: `b-${i}`,
      title: `Signal ${i + 1}`,
      body: text,
      severity: severityFromInsightText(text),
    }));
  }, [insight.bullets]);

  const filteredRows = useMemo(() => {
    if (severityFilter === "all") return insightRows;
    return insightRows.filter((r) => r.severity === severityFilter);
  }, [insightRows, severityFilter]);

  return (
    <div className="ds-stack-4 min-w-0">
      <DsSectionHeader
        title="Portfolio intelligence"
        description="Structured signals from the latest run. Severity is heuristic; open the full report for governance context."
      />

      <DsCard padding="md" className="ds-stack-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <DsMetricTile label="Portfolio (hint)" value={portfolio ?? "—"} />
          <DsMetricTile
            label="Risk score"
            value={insight.riskScore != null ? `${Math.round(insight.riskScore)} / 100` : "—"}
          />
          <div className="flex min-w-0 flex-col justify-center gap-2 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="ds-caption">Posture</p>
            <div className="flex flex-wrap items-center gap-2">
              <DsBadge variant={insight.health.kind === "pending" ? "neutral" : "accent"}>
                {healthLabel(insight.health)}
              </DsBadge>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-3">
          <p className="ds-caption">Key insight</p>
          <p className="ds-body mt-2 text-[var(--text-secondary)] ds-line-clamp-3">{keyInsight}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.98]"
          >
            Full report
          </button>
        </div>
      </DsCard>

      {insightRows.length > 0 ? (
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="ds-h3">Insights</h3>
            <div className="flex min-w-0 flex-wrap gap-1.5" role="toolbar" aria-label="Filter by severity">
              {FILTER_LABELS.map((f) => {
                const active =
                  f.id === "all" ? severityFilter === "all" : severityFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSeverityFilter(f.id)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition active:scale-[0.97] ${
                      active
                        ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <ul className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
            {filteredRows.map((row) => (
              <li
                key={row.id}
                className="flex min-h-[88px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">{row.title}</p>
                  <DsBadge variant={severityVariant(row.severity)} className="shrink-0 capitalize">
                    {row.severity}
                  </DsBadge>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)] ds-line-clamp-2 break-words">
                  {row.body}
                </p>
              </li>
            ))}
          </ul>
          {filteredRows.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">No signals for this filter.</p>
          ) : null}
        </div>
      ) : null}

      {insight.chips.length > 0 ? (
        <div className="min-w-0">
          <h3 className="ds-h3">Recommendations</h3>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            {insight.chips.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const sev = severityFromInsightText(c);
                  setSeverityFilter(sev);
                }}
                className="max-w-full min-w-0 rounded-full border border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] px-3 py-1 text-left text-[12px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] active:scale-[0.98]"
              >
                <span className="max-w-[280px] truncate">{c}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ReportModal
        open={reportOpen}
        title="Full portfolio report"
        markdown={insight.fullMarkdown}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
