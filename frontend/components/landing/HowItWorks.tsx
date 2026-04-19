import { LandingSection } from "./LandingSection";

function IconLink() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 5a3 3 0 00-3 3v1a2 2 0 00-2 2v2h10v-2a2 2 0 00-2-2V8a3 3 0 00-3-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 15h6v3a2 2 0 01-2 2h-2a2 2 0 01-2-2v-3z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 7h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const steps = [
  {
    Icon: IconLink,
    line: "Connect accounts: link brokerage, retirement, and cash in one secure session.",
  },
  {
    Icon: IconBrain,
    line: "AI analyzes portfolio: risk, allocation, and retirement paths scored on your data.",
  },
  {
    Icon: IconDoc,
    line: "Intelligence report: structured memo with rationale you can act on or archive.",
  },
  {
    Icon: IconTrend,
    line: "Long-term strategy: monitor drift and scenarios as markets and balances move.",
  },
] as const;

export default function HowItWorks() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        How it works
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        Four steps from connection to ongoing oversight.
      </p>
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {steps.map((s, i) => (
          <li key={s.line} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--accent)]">
              <s.Icon />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Step {i + 1}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-[var(--text-primary)]">{s.line}</p>
            </div>
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
