export type InsightSeverity = "low" | "medium" | "high";

/** Heuristic severity for dashboard / analysis insight lines (UI only). */
export function severityFromInsightText(text: string): InsightSeverity {
  const t = text.toLowerCase();
  if (
    /critical|severe|urgent|immediate|liquidat|margin call|breach|collapse|bankrupt|fraud|unsustainable|extreme/.test(
      t
    )
  ) {
    return "high";
  }
  if (
    /elevated|concentrat|underdiversif|volatile|drawdown|downside|warning|caution|material|significant/.test(t)
  ) {
    return "medium";
  }
  return "low";
}
