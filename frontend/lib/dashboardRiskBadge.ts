import { toNumber } from "@/lib/format";

export type RiskBadgeVariant = "neutral" | "warn" | "accent";

export type RiskBadge = {
  label: string;
  variant: RiskBadgeVariant;
};

/**
 * Heuristic risk posture from allocation + position coverage (UI only, not advice).
 */
export function riskBadgeFromPortfolio(
  breakdown: Record<string, number>,
  totalValue: number,
  totalPositionsCount: number
): RiskBadge {
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return { label: "Awaiting book", variant: "neutral" };
  }

  const cash = toNumber(breakdown.cash);
  const equity = toNumber(breakdown.equity);
  const fi = toNumber(breakdown.fixed_income);
  const alt = toNumber(breakdown.alternatives);
  const unclassified = toNumber(breakdown.unclassified);

  if (totalPositionsCount === 0 && cash > 0 && Math.abs(totalValue - cash) < 1) {
    return { label: "Cash only", variant: "warn" };
  }

  const eqShare = equity / totalValue;
  const cashShare = cash / totalValue;

  if (eqShare >= 0.82) {
    return { label: "Equity heavy", variant: "warn" };
  }
  if (cashShare >= 0.55) {
    return { label: "Very liquid", variant: "neutral" };
  }
  if (unclassified / totalValue >= 0.35 && totalPositionsCount > 0) {
    return { label: "Unclassified risk", variant: "warn" };
  }
  if (alt / totalValue >= 0.2) {
    return { label: "Alts emphasis", variant: "neutral" };
  }
  if (eqShare >= 0.45 && fi >= totalValue * 0.15) {
    return { label: "Balanced", variant: "accent" };
  }
  return { label: "Core risk", variant: "neutral" };
}

/**
 * Deterministic 0–100 risk index from allocation + book shape (UI only).
 * Used when the LLM report does not embed a numeric risk score.
 */
export function riskScoreFromPortfolio(
  breakdown: Record<string, number>,
  totalValue: number,
  totalPositionsCount: number
): number {
  if (!Number.isFinite(totalValue) || totalValue <= 0) return 0;

  const equity = toNumber(breakdown.equity) / totalValue;
  const cash = toNumber(breakdown.cash) / totalValue;
  const fi = toNumber(breakdown.fixed_income) / totalValue;
  const alt = toNumber(breakdown.alternatives) / totalValue;
  const unclassified = toNumber(breakdown.unclassified) / totalValue;

  // Equity and alternatives lift score; cash and bonds dampen; unclassified adds uncertainty.
  let raw =
    equity * 72 +
    alt * 38 +
    unclassified * 52 +
    (1 - fi) * 8 -
    cash * 28;
  if (totalPositionsCount === 0 && cash >= 0.995) {
    raw = Math.min(raw, 26);
  }
  return Math.min(100, Math.max(0, Math.round(raw)));
}
