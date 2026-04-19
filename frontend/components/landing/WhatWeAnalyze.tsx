import { LandingSection } from "./LandingSection";

const cards = [
  {
    title: "Portfolio allocation intelligence",
    body: "See how capital is deployed across asset classes and sleeves, not reduced to a single headline equity figure.",
  },
  {
    title: "Risk concentration detection",
    body: "Surfaces issuer, sector, and factor crowding before a drawdown names the problem for you.",
  },
  {
    title: "Retirement trajectory simulation",
    body: "Stress income, savings rate, and market paths to judge sustainability, not a single static nest egg.",
  },
  {
    title: "Multi-account aggregation",
    body: "One analytical layer across brokerage, retirement, and cash so decisions are portfolio-level.",
  },
  {
    title: "AI financial reasoning layer",
    body: "Narrative synthesis that ties positions, risk, and goals, written to read like an analyst memo.",
  },
] as const;

export default function WhatWeAnalyze() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        What AlexFin analyzes
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        Institutional questions, answered for personal wealth, without waiting for a quarterly review.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {cards.map((c) => (
          <li
            key={c.title}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors duration-200 hover:border-[rgba(76,130,251,0.35)]"
          >
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              {c.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{c.body}</p>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
