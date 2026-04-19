import { buildPortfolioBrief, type BriefSection } from "@/lib/briefParser";
import { formatUsd, toNumber } from "@/lib/format";
import type { ApiJob } from "@/lib/useDashboardData";

export type HealthGrade =
  | { kind: "letter"; letter: "A" | "B" | "C" | "D" | "F" }
  | { kind: "pending" };

export function portfolioHealthFromRisk(riskScore: number | null): HealthGrade {
  if (riskScore == null || !Number.isFinite(riskScore)) return { kind: "pending" };
  const s = Math.min(100, Math.max(0, riskScore));
  if (s <= 28) return { kind: "letter", letter: "A" };
  if (s <= 42) return { kind: "letter", letter: "B" };
  if (s <= 58) return { kind: "letter", letter: "C" };
  if (s <= 72) return { kind: "letter", letter: "D" };
  return { kind: "letter", letter: "F" };
}

export type StructuredInsight = {
  title: string;
  riskScore: number | null;
  health: HealthGrade;
  bullets: string[];
  chips: string[];
  fullMarkdown: string;
  sections: BriefSection[];
};

function bucket(title: string): string {
  const t = title.toLowerCase();
  if (/recommend|action|next|summary|conclusion/.test(t)) return "recommendations";
  if (/risk|volatil|drawdown|beta/.test(t)) return "risk";
  return "other";
}

function extractRiskScore(text: string): number | null {
  const patterns = [
    /risk\s*(?:score|rating)?\s*[:#]?\s*(\d{1,3})\s*(?:\/\s*100)?/i,
    /(\d{1,3})\s*\/\s*100\s*(?:risk|score)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    }
  }
  return null;
}

function buildMarkdown(job: ApiJob): string {
  const parts: string[] = [];
  const c = job.report_payload?.content;
  if (typeof c === "string" && c.trim()) parts.push(c.trim());
  const s = job.summary_payload as Record<string, unknown> | undefined;
  if (s && typeof s === "object") {
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "string" && v.trim()) {
        parts.push(`### ${k.replace(/_/g, " ")}\n\n${v.trim()}`);
      }
    }
  }
  return parts.join("\n\n---\n\n");
}

/** Structured brief from markdown + optional summary alone (e.g. retirement tab). */
export function buildStructuredInsightFromContent(
  reportMd: string | undefined,
  summary: Record<string, unknown> | undefined
): StructuredInsight {
  const stub = {
    id: "",
    status: "completed",
    created_at: "",
    report_payload: reportMd?.trim() ? { content: reportMd.trim() } : undefined,
    summary_payload: summary,
  } as ApiJob;
  return buildStructuredInsight(stub);
}

/** Best-effort portfolio headline for analysis summary cards (summary JSON or report text). */
export function formatPortfolioValueFromJob(job: ApiJob): string | null {
  const sp = job.summary_payload;
  if (sp && typeof sp === "object") {
    const keys = [
      "total_portfolio_value",
      "portfolio_value",
      "total_value",
      "notional_usd",
      "portfolio_usd",
    ];
    for (const k of keys) {
      const v = sp[k];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return formatUsd(v);
      if (typeof v === "string") {
        const n = toNumber(v.replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(n) && n > 0) return formatUsd(n);
      }
    }
  }
  const md = job.report_payload?.content ?? "";
  const m = md.match(/\$[\d,]+(?:\.\d{2})?/);
  if (m) return m[0];
  return null;
}

export function buildStructuredInsight(job: ApiJob): StructuredInsight {
  const reportMd = job.report_payload?.content?.trim();
  const summary = job.summary_payload as Record<string, unknown> | undefined;
  const sections = buildPortfolioBrief(reportMd, summary);
  const title = sections[0]?.title?.trim() || "Portfolio intelligence";

  const allBullets = sections
    .flatMap((sec) => sec.bullets)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);

  const bullets = allBullets.slice(0, 5);

  const recSections = sections.filter((s) => bucket(s.title) === "recommendations");
  const chipsSource =
    recSections.length > 0
      ? recSections.flatMap((s) => s.bullets)
      : sections.length > 0
        ? sections[sections.length - 1].bullets
        : allBullets;
  const chips = chipsSource
    .map((c) => c.slice(0, 72) + (c.length > 72 ? "…" : ""))
    .filter(Boolean)
    .slice(0, 4);

  const md = buildMarkdown(job);
  let riskScore = extractRiskScore(md);
  if (riskScore == null && summary) {
    for (const v of Object.values(summary)) {
      if (typeof v === "string") {
        riskScore = extractRiskScore(v);
        if (riskScore != null) break;
      }
    }
  }

  const health = portfolioHealthFromRisk(riskScore);

  return {
    title,
    riskScore,
    health,
    bullets,
    chips,
    fullMarkdown: md || reportMd || "",
    sections,
  };
}
