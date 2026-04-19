import { LandingSection } from "./LandingSection";

const steps = [
  {
    step: "1",
    title: "Connect portfolio",
    body: "Clerk-authenticated session; the API validates bearer JWTs and scopes data to your `clerk_user_id`.",
  },
  {
    step: "2",
    title: "Agent orchestration",
    body: "A portfolio job record is created and a message is sent to SQS; Lambda workers run the analysis pipeline.",
  },
  {
    step: "3",
    title: "Stored insights",
    body: "Job status and payloads are written to Postgres via Supabase; the dashboard reads them over the REST API.",
  },
];

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
        System flow from authentication through persistence—no marketing steps.
      </p>
      <ol className="mt-12 grid gap-10 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.step} className="relative pl-0 md:pl-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--text-primary)]">
              {s.step}
            </span>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
