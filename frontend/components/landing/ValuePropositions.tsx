import { FeatureCard } from "./FeatureCard";
import { LandingSection } from "./LandingSection";

const items: { title: string; body: string }[] = [
  {
    title: "Portfolio Intelligence Engine",
    body: "Aggregates accounts, cash, and positions from your API to compute totals and asset-class exposure when instrument metadata allows.",
  },
  {
    title: "Allocation Drift Detection",
    body: "Surfaces how booked weights compare to your stated targets once profile targets and priced holdings are both present.",
  },
  {
    title: "Retirement Scenario Modeling",
    body: "Stores retirement-related agent outputs on completed jobs for review in the dashboard when the pipeline produces them.",
  },
  {
    title: "Multi-Agent Financial Analysis",
    body: "Queues portfolio jobs to SQS for Lambda-based agents, then persists structured payloads you can inspect per job.",
  },
];

export default function ValuePropositions() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--bg)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        Capabilities
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        Each item maps to shipped behavior in this repository—not a roadmap slide.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
        {items.map((item) => (
          <li key={item.title}>
            <FeatureCard title={item.title}>{item.body}</FeatureCard>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
