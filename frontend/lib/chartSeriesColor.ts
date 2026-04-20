/**
 * Map portfolio / onboarding slice keys to semantic chart CSS variables.
 */
export function fillForPieKey(
  key: string,
  opts: {
    ghost?: boolean;
    index: number;
    gridFallback: string;
    series: string[];
  },
): string {
  const { ghost, index, gridFallback, series } = opts;
  const k = key.toLowerCase();
  if (ghost) {
    if (k === "g1") return "var(--chart-equity)";
    if (k === "g2") return "var(--chart-fixed-income)";
    if (k === "g3") return "var(--chart-cash)";
    if (k === "g4") return "var(--chart-alt)";
    if (k === "pending" || k === "empty") return gridFallback;
    return gridFallback;
  }
  if (k === "equity" || k === "g1") return "var(--chart-equity)";
  if (k === "fixed_income" || k === "bonds" || k === "g2") return "var(--chart-fixed-income)";
  if (k === "cash" || k === "g3") return "var(--chart-cash)";
  if (k === "alternatives" || k === "alternative" || k === "alt" || k === "g4")
    return "var(--chart-alt)";
  if (k === "unclassified" || k === "pending") return series[index % series.length] ?? gridFallback;
  return series[index % series.length] ?? "var(--chart-1)";
}
