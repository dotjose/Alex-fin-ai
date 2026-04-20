import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { buildStructuredInsightFromContent } from "@/lib/insightStructure";

type Props = {
  markdown: string;
};

function healthLine(
  riskScore: number | null,
  health: ReturnType<typeof buildStructuredInsightFromContent>["health"],
): string {
  if (health.kind === "pending") {
    return riskScore != null && Number.isFinite(riskScore)
      ? `Risk score: ${Math.round(riskScore)} / 100`
      : "Risk: not scored in this report.";
  }
  return `Risk grade: ${health.letter}${riskScore != null ? ` · score ${Math.round(riskScore)}/100` : ""}`;
}

/**
 * Collapsible, scannable report — raw markdown lives in a single appendix block.
 */
export function ReportStructuredView({ markdown }: Props) {
  const insight = useMemo(
    () => buildStructuredInsightFromContent(markdown, undefined),
    [markdown],
  );

  const topBullets = insight.bullets.slice(0, 5);
  const sections = insight.sections.filter((s) => (s.bullets?.length ?? 0) > 0 || s.title?.trim());

  return (
    <div className="ds-stack-3 min-w-0">
      <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="ds-caption">At a glance</p>
        <ul className="mt-2 space-y-2 text-sm text-[var(--text-primary)]">
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--success)]" aria-hidden>
              ✓
            </span>
            <span>{healthLine(insight.riskScore, insight.health)}</span>
          </li>
          {topBullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-[var(--accent)]" aria-hidden>
                •
              </span>
              <span className="text-[var(--text-secondary)]">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {sections.length > 0 ? (
        <div className="ds-stack-2">
          <p className="ds-caption">Sections</p>
          <div className="space-y-2">
            {sections.slice(0, 8).map((sec, idx) => (
              <details
                key={`${sec.title}-${idx}`}
                className="group rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)] marker:text-[var(--text-secondary)]">
                  {sec.title?.trim() || `Section ${idx + 1}`}
                </summary>
                {sec.bullets.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
                    {sec.bullets.slice(0, 12).map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">No bullets in this section.</p>
                )}
              </details>
            ))}
          </div>
        </div>
      ) : null}

      <details className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
          Full narrative (markdown)
        </summary>
        <div className="ds-prose-safe mt-3 max-w-none space-y-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-primary)] [&_a]:break-words [&_a]:text-[var(--accent)] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:break-words [&_h2]:text-base [&_h2]:font-semibold [&_li]:text-[var(--text-secondary)] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:break-words [&_p]:text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </details>
    </div>
  );
}
