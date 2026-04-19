import type { ApiInstrument, ApiJob, ApiPosition } from "@/lib/useDashboardData";

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type ChartRow = { name: string; value: number };

/** Group position value by instrument_type (fallback: Other). */
export function sectorExposureRows(
  positionsByAccount: Record<string, ApiPosition[]>,
  instruments: Record<string, ApiInstrument>
): ChartRow[] {
  const map = new Map<string, number>();
  for (const positions of Object.values(positionsByAccount)) {
    for (const p of positions) {
      const inst = instruments[p.symbol];
      const price = inst ? toNumber(inst.current_price) : 0;
      const qty = toNumber(p.quantity);
      const v = price * qty;
      if (v <= 0) continue;
      const raw = inst?.instrument_type?.trim();
      const label = raw && raw.length > 0 ? raw : "Other";
      map.set(label, (map.get(label) || 0) + v);
    }
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}

/** Target vs actual gap (percentage points) for equity / fixed income when targets exist. */
export function allocationDriftRows(
  assetClassBreakdown: Record<string, number>,
  totalValue: number,
  targets: { equity?: number; fixed_income?: number } | null | undefined
): ChartRow[] {
  if (!targets || totalValue <= 0) return [];
  const eqT = toNumber(targets.equity);
  const fiT = toNumber(targets.fixed_income);
  if (eqT <= 0 && fiT <= 0) return [];

  const eqV = toNumber(assetClassBreakdown.equity);
  const fiV = toNumber(assetClassBreakdown.fixed_income);
  const eqPct = (eqV / totalValue) * 100;
  const fiPct = (fiV / totalValue) * 100;

  const rows: ChartRow[] = [];
  if (eqT > 0 || eqPct > 0) {
    rows.push({
      name: "Equity",
      value: Math.round((eqPct - eqT) * 10) / 10,
    });
  }
  if (fiT > 0 || fiPct > 0) {
    rows.push({
      name: "Fixed income",
      value: Math.round((fiPct - fiT) * 10) / 10,
    });
  }
  return rows;
}

/** Cumulative completed analyses over time (honest when NAV history is unavailable). */
export function analysisCadenceSeries(jobs: ApiJob[]): { label: string; cumulative: number }[] {
  const completed = jobs
    .filter((j) => j.status === "completed")
    .map((j) => ({
      t: new Date(j.completed_at || j.created_at).getTime(),
      id: j.id,
    }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  let n = 0;
  return completed.map((c) => {
    n += 1;
    return {
      label: new Date(c.t).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      cumulative: n,
    };
  });
}
