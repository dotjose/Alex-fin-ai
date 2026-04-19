/**
 * Turn API markdown / summary into structured “AI Portfolio Brief” blocks (UI only).
 */

export type BriefSection = {
  id: string;
  title: string;
  bullets: string[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function linesToBullets(block: string): string[] {
  const out: string[] = [];
  for (const line of block.split(/\n+/)) {
    const t = line.replace(/^[-*•]\s*/, "").trim();
    if (t.length >= 8 && t.length <= 400) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function splitMarkdownByH2(md: string): { title: string; body: string }[] {
  const trimmed = md.trim();
  if (!/^##\s+/m.test(trimmed)) return [];
  const parts = trimmed.split(/^##\s+/gm);
  const sections: { title: string; body: string }[] = [];
  for (const raw of parts) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const nl = chunk.indexOf("\n");
    const title = nl === -1 ? chunk : chunk.slice(0, nl).trim();
    const body = nl === -1 ? "" : chunk.slice(nl + 1).trim();
    if (title) sections.push({ title, body });
  }
  return sections;
}

const BUCKET_ORDER: Record<string, number> = {
  diversification: 0,
  risk: 1,
  sector: 2,
  retirement: 3,
  recommendations: 4,
  other: 5,
};

function titleBucket(title: string): string {
  const t = title.toLowerCase();
  if (/diversif|concentrat|balance/.test(t)) return "diversification";
  if (/risk|volatil|drawdown|beta/.test(t)) return "risk";
  if (/sector|industry|allocation/.test(t)) return "sector";
  if (/retir|income|withdraw|longevity/.test(t)) return "retirement";
  if (/recommend|action|next|summary|conclusion/.test(t)) return "recommendations";
  return "other";
}

export function buildPortfolioBrief(
  reportMd: string | undefined,
  summary: Record<string, unknown> | undefined
): BriefSection[] {
  const md = (reportMd || "").trim();
  const fromMd = splitMarkdownByH2(md);
  if (fromMd.length > 0) {
    return fromMd.map(({ title, body }) => ({
      id: slug(title),
      title,
      bullets: linesToBullets(body) || [body.slice(0, 320) + (body.length > 320 ? "…" : "")],
    }));
  }

  const fromSummary: BriefSection[] = [];
  if (summary && typeof summary === "object") {
    for (const [key, value] of Object.entries(summary)) {
      let text: string | null = null;
      if (typeof value === "string" && value.trim()) text = value.trim();
      else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
      if (!text) continue;
      const title = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      fromSummary.push({
        id: slug(key),
        title,
        bullets: [text.slice(0, 480) + (text.length > 480 ? "…" : "")],
      });
      if (fromSummary.length >= 6) break;
    }
  }

  if (md) {
    const paras = md
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 40);
    const bullets = paras.slice(0, 6);
    if (bullets.length) {
      fromSummary.push({
        id: "analysis-narrative",
        title: "Analysis narrative",
        bullets,
      });
    }
  }

  fromSummary.sort((a, b) => {
    const ba = BUCKET_ORDER[titleBucket(a.title)] ?? 99;
    const bb = BUCKET_ORDER[titleBucket(b.title)] ?? 99;
    return ba - bb;
  });

  return fromSummary;
}
