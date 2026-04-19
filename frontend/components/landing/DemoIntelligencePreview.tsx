import Link from "next/link";
import { LandingSection } from "./LandingSection";

export default function DemoIntelligencePreview() {
  return (
    <LandingSection
      id="example-ai-insight"
      className="border-b border-[var(--border)] bg-[var(--bg)]"
      pad="lg"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-16">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Example AI insight
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Representative output format, condensed for the landing page. Full narratives, charts, and
            audit trail live in your workspace.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <ul className="space-y-3 text-sm leading-relaxed text-[var(--text-primary)]">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                <span className="font-medium text-[var(--text-primary)]">Risk score:</span>{" "}
                <span className="font-mono tabular-nums">64 / 100</span>
                <span className="text-[var(--text-secondary)]"> (elevated single-name equity)</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                <span className="font-medium">Allocation issue:</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  U.S. large-cap growth is 41% of assets vs. 28% policy; developed international is 6%
                  vs. 18% benchmark, compressing diversification.
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                <span className="font-medium">Recommendation:</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  Trim two growth leaders by 4–6% each, add MSCI EAFE core and short-duration
                  Treasuries; at 5.2% real return this improves funded ratio to age 90 from 0.87 to 0.94.
                </span>
              </span>
            </li>
          </ul>
          <p className="mt-6 text-xs text-[var(--text-secondary)]">
            <Link
              href="/dashboard"
              className="font-medium text-[var(--accent)] underline-offset-4 transition hover:underline"
            >
              View full analysis inside dashboard
            </Link>
          </p>
        </div>
      </div>
    </LandingSection>
  );
}
