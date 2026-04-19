import type { ApiJob } from "@/lib/useDashboardData";

export const PIPELINE_ORDER = [
  "planner",
  "tagger",
  "reporter",
  "charter",
  "retirement",
] as const;

export type PipelineAgent = (typeof PIPELINE_ORDER)[number];

export const PIPELINE_LABELS: Record<PipelineAgent, string> = {
  planner: "Planning…",
  tagger: "Evaluating…",
  reporter: "Generating insights…",
  charter: "Building report…",
  retirement: "Finalizing…",
};

export type PipelineStep = {
  status?: string;
  at?: string | null;
  error?: string;
  detail?: string;
};

export function readPipeline(
  job: ApiJob | null | undefined
): Partial<Record<PipelineAgent, PipelineStep>> {
  const raw = job?.request_payload as Record<string, unknown> | undefined;
  const orch = raw?._orch as Record<string, unknown> | undefined;
  const pl = orch?.pipeline as Record<string, PipelineStep> | undefined;
  if (!pl || typeof pl !== "object") return {};
  const out: Partial<Record<PipelineAgent, PipelineStep>> = {};
  for (const k of PIPELINE_ORDER) {
    const v = pl[k];
    if (v && typeof v === "object") out[k] = v as PipelineStep;
  }
  return out;
}

export function formatStepTime(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function chipClass(status: string | undefined): string {
  switch (status) {
    case "running":
    case "queued":
      return "bg-[color-mix(in_srgb,var(--accent)_14%,var(--card))] text-[var(--accent)] ring-1 ring-[var(--border)]";
    case "completed":
      return "bg-[color-mix(in_srgb,var(--success)_14%,var(--card))] text-[var(--success)] ring-1 ring-[var(--border)]";
    case "failed":
      return "bg-[color-mix(in_srgb,var(--danger)_14%,var(--card))] text-[var(--danger)] ring-1 ring-[var(--border)]";
    default:
      return "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]";
  }
}

export function pipelineChipClass(status: string | undefined): string {
  return `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-200 ${chipClass(status)}`;
}
