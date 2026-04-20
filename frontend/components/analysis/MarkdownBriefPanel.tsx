import { useMemo, useState } from "react";
import { buildStructuredInsightFromContent } from "@/lib/insightStructure";
import { DsBadge, DsCard, DsSectionHeader, ReportModal } from "@/components/ds";

function oneSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const dot = t.indexOf(".");
  if (dot > 0 && dot <= 220) return t.slice(0, dot + 1);
  return t.length > 220 ? `${t.slice(0, 217)}…` : t;
}

type Props = {
  title: string;
  description?: string;
  markdown: string;
  modalTitle?: string;
};

/** Retirement (or any) long markdown → same bounded pattern as portfolio overview. */
export function MarkdownBriefPanel({
  title,
  description,
  markdown,
  modalTitle = "Full analysis",
}: Props) {
  const [open, setOpen] = useState(false);
  const insight = useMemo(
    () => buildStructuredInsightFromContent(markdown, undefined),
    [markdown]
  );
  const keyInsight =
    oneSentence(insight.bullets[0] ?? "") || "Open the full report for complete detail.";

  return (
    <div className="ds-stack-4 min-w-0">
      <DsSectionHeader title={title} description={description} />
      <DsCard padding="lg" className="ds-stack-3">
        <div className="min-w-0 border-b border-[var(--border)] pb-3">
          <p className="ds-caption">Summary</p>
          <p className="ds-body-muted mt-2 ds-line-clamp-4 break-words">{keyInsight}</p>
        </div>
        {insight.bullets.length > 0 ? (
          <div>
            <p className="ds-caption">Highlights</p>
            <ul className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              {insight.bullets.slice(0, 5).map((b, i) => (
                <li
                  key={i}
                  className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-snug text-[var(--text-secondary)] ds-line-clamp-5 break-words"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {insight.sections.length > 1 ? (
          <div>
            <p className="ds-caption">Brief sections</p>
            <div className="mt-2 space-y-2">
              {insight.sections.slice(0, 5).map((sec, idx) => (
                <details
                  key={`${sec.id}-${idx}`}
                  className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
                    {sec.title?.trim() || `Section ${idx + 1}`}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                    {sec.bullets.slice(0, 4).map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        ) : null}
        {insight.chips.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            {insight.chips.map((c, i) => (
              <DsBadge key={i} variant="accent" className="max-w-full min-w-0">
                <span className="max-w-[280px] truncate">{c}</span>
              </DsBadge>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] transition hover:opacity-95"
        >
          Full report
        </button>
      </DsCard>
      <ReportModal open={open} title={modalTitle} markdown={markdown} onClose={() => setOpen(false)} />
    </div>
  );
}
