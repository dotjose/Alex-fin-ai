const KEY = "alexfin:lastInsightJob";

export type CachedInsight = {
  jobId: string;
  completedAt?: string;
  snapshotTitle: string;
  snapshotBullets: string[];
  fullMarkdown: string;
};

function safeParse(raw: string | null): CachedInsight | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CachedInsight;
    if (v && typeof v.jobId === "string" && typeof v.fullMarkdown === "string") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readCachedInsight(): CachedInsight | null {
  if (typeof window === "undefined") return null;
  try {
    return safeParse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writeCachedInsight(payload: CachedInsight): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedInsight(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
