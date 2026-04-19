/**
 * Heuristic hints from AI narrative to align charts (e.g. highlight a segment).
 */

const SECTOR_PATTERNS: { hint: string; matchers: RegExp[] }[] = [
  {
    hint: "technology",
    matchers: [/technology/i, /\btech\b/i, /information technology/i, /\bit\b\s+sector/i],
  },
  {
    hint: "health care",
    matchers: [/health\s*care/i, /healthcare/i, /\bpharma/i],
  },
  {
    hint: "financial",
    matchers: [/financials?/i, /\bbanks?\b/i, /financial services/i],
  },
  {
    hint: "energy",
    matchers: [/\benergy\b/i, /oil and gas/i],
  },
  {
    hint: "consumer",
    matchers: [/consumer discretionary/i, /consumer staples/i],
  },
];

export function parseOverweightHints(narrative: string): string[] {
  if (!narrative.trim()) return [];
  const lower = narrative.toLowerCase();
  if (!/(overweight|concentrat|tilt|skew|exposure\s+to)/i.test(lower)) {
    return [];
  }
  const out: string[] = [];
  for (const { hint, matchers } of SECTOR_PATTERNS) {
    if (matchers.some((m) => m.test(narrative))) out.push(hint);
  }
  return out;
}

export function rowMatchesNarrativeHint(
  rowName: string,
  hints: string[]
): boolean {
  if (!hints.length) return false;
  const n = rowName.toLowerCase();
  return hints.some((h) => n.includes(h) || (h === "technology" && n.includes("tech")));
}
