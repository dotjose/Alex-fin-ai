import { FeatureCard } from "./FeatureCard";
import { LandingSection } from "./LandingSection";

const items: { title: string; line: string; outcome: string }[] = [
  {
    title: "Portfolio Intelligence Engine",
    line: "Unified analytics across positions, cash, and held-away balances.",
    outcome: "Spend time on decisions, not spreadsheets: one net worth and risk picture.",
  },
  {
    title: "Allocation Drift Detection",
    line: "Continuous comparison of live weights to your stated policy portfolio.",
    outcome: "Catch style creep early so a bull market does not quietly rewrite your risk.",
  },
  {
    title: "Retirement Modeling AI",
    line: "Scenario paths for returns, savings, and draw timing with plain-language tradeoffs.",
    outcome: "Know whether you are on track to fund spending through age 90, not just “on track.”",
  },
  {
    title: "Multi-account aggregation",
    line: "Brokerage, IRA/401(k), and cash treated as one investable stack.",
    outcome: "Tax-location and liquidity decisions reflect the whole balance sheet.",
  },
  {
    title: "Risk concentration analysis",
    line: "Issuer, sector, and factor overlap mapped to loss sensitivity.",
    outcome: "See crowding before a single name or theme dominates downside.",
  },
];

export default function ValuePropositions() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--bg)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        Outcomes, not feature checklists
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        Each capability is built to answer a CFO-level portfolio question in language you can act on.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {items.map((item) => (
          <li key={item.title}>
            <FeatureCard title={item.title}>
              <>
                <span className="block">{item.line}</span>
                <span className="mt-2 block border-t border-[var(--border)] pt-2 text-[var(--text-primary)]">
                  {item.outcome}
                </span>
              </>
            </FeatureCard>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
