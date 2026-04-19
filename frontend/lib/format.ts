/** Shared number formatting for portfolio UI (no mock values). */

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "No data";
  if (value === 0) return "$0";
  const opts: Intl.NumberFormatOptions =
    value % 1 === 0
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    ...opts,
  }).format(value);
}

export function formatUsdDetailed(value: number): string {
  if (!Number.isFinite(value)) return "No data";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

/** Display share of total (0–100). */
export function formatPercentOfWhole(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
