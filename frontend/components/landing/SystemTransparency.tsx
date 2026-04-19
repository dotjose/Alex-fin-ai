import { LandingSection } from "./LandingSection";

const stack = [
  {
    name: "Supabase",
    detail: "Postgres for accounts, positions, jobs, and embeddings; accessed from the API through PostgREST with the service role on the server only.",
  },
  {
    name: "OpenRouter",
    detail: "LLM calls for agents use OpenRouter model IDs configured in the API environment.",
  },
  {
    name: "AWS Lambda",
    detail: "FastAPI (Mangum) and the SQS worker run as container images on Lambda in the deployed stack.",
  },
  {
    name: "Amazon SQS",
    detail: "Analysis requests enqueue JSON messages consumed by the worker; the queue URL must be present for POST /api/analyze to succeed.",
  },
];

export default function SystemTransparency() {
  return (
    <LandingSection
      id="architecture"
      className="border-b border-[var(--border)] bg-[var(--bg)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        How AlexFin.ai works
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        High-level components of the production architecture this codebase targets.
      </p>
      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        {stack.map((row) => (
          <div
            key={row.name}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-[box-shadow,border-color] duration-200 hover:border-[var(--border)]"
          >
            <dt className="text-sm font-semibold text-[var(--text-primary)]">{row.name}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {row.detail}
            </dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
