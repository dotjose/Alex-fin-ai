/** Compact relative time for data-freshness strip (no external deps). */
export function formatDataFreshness(at: Date | null): string {
  if (!at) return "Awaiting sync";
  const sec = Math.floor((Date.now() - at.getTime()) / 1000);
  if (sec < 0) return "Just now";
  if (sec < 8) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
