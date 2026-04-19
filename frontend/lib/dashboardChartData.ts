import type { ApiJob } from "@/lib/useDashboardData";

/** Best-effort portfolio value over time from job summaries + current total. */
export function portfolioValueTimeline(
  jobs: ApiJob[],
  currentTotal: number
): { label: string; value: number; jobId?: string }[] {
  const completed = jobs
    .filter((j) => j.status === "completed")
    .map((j) => {
      const t = new Date(j.completed_at || j.created_at).getTime();
      const s = j.summary_payload as Record<string, unknown> | undefined;
      let v: number | null = null;
      if (s && typeof s === "object") {
        for (const key of [
          "total_value",
          "totalValue",
          "portfolio_value",
          "portfolioValue",
          "nav",
        ]) {
          const raw = s[key];
          const n =
            typeof raw === "number"
              ? raw
              : typeof raw === "string"
                ? parseFloat(raw)
                : NaN;
          if (Number.isFinite(n) && n > 0) {
            v = n;
            break;
          }
        }
      }
      return { t, value: v, jobId: j.id };
    })
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  let lastValid = 0;
  const points: { label: string; value: number; jobId?: string }[] = [];
  for (const c of completed) {
    const fromJob =
      c.value != null && Number.isFinite(c.value) && c.value > 0 ? c.value : null;
    const val =
      fromJob ??
      (lastValid > 0 ? lastValid : currentTotal > 0 ? currentTotal : 0);
    if (val > 0) lastValid = val;
    points.push({
      label: new Date(c.t).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: Math.round(val * 100) / 100,
      jobId: c.jobId,
    });
  }

  if (points.length === 0 && currentTotal > 0) {
    points.push({
      label: "Now",
      value: Math.round(currentTotal * 100) / 100,
    });
    return points;
  }

  if (points.length > 0 && currentTotal > 0) {
    const lastP = points[points.length - 1];
    if (!lastP) return points;
    const diff = Math.abs(lastP.value - currentTotal);
    if (diff > Math.max(1, currentTotal * 0.002)) {
      points.push({
        label: "Now",
        value: Math.round(currentTotal * 100) / 100,
      });
    }
  }

  return points;
}
