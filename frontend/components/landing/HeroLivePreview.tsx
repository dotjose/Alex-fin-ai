import { useEffect, useState } from "react";

/**
 * Neutral UI shell only — no dollar amounts, percentages, or market figures.
 * Illustrates layout parity with the signed-in dashboard.
 */
export default function HeroLivePreview() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % 6);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  const w = (base: number, i: number) => {
    const drift = Math.sin((phase + i) * 0.45) * 5;
    return Math.round(Math.min(92, Math.max(38, base + drift)));
  };

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      aria-hidden
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        Application preview
      </p>
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Total portfolio value
          </span>
          <span className="font-mono text-sm text-[var(--text-secondary)]">—</span>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          Allocation
        </p>
        <ul className="mt-3 space-y-2">
          {(
            [
              ["Equity", 72],
              ["Fixed income", 48],
              ["Cash", 36],
              ["Alternatives", 54],
            ] as const
          ).map(([label, base], i) => (
            <li key={label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
              <div className="h-2 flex-1 max-w-[200px] overflow-hidden rounded-full bg-[rgba(230,234,240,0.06)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                  style={{ width: `${w(base, i)}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-xs text-[var(--text-secondary)]">
                —
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          AI insight
        </p>
        <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[rgba(76,130,251,0.25)] bg-[rgba(76,130,251,0.06)] p-3">
          <p className="text-[11px] font-medium leading-snug text-[var(--text-primary)]">
            Concentration &amp; risk posture
          </p>
          <div className="space-y-2">
            <div
              className="h-1.5 max-w-[280px] rounded bg-[rgba(230,234,240,0.12)] transition-[width] duration-700 ease-out"
              style={{ width: `${w(78, 0)}%` }}
            />
            <div
              className="h-1.5 max-w-[220px] rounded bg-[rgba(230,234,240,0.1)] transition-[width] duration-700 ease-out"
              style={{ width: `${w(55, 1)}%` }}
            />
            <div
              className="h-1.5 max-w-[240px] rounded bg-[rgba(230,234,240,0.08)] transition-[width] duration-700 ease-out"
              style={{ width: `${w(64, 2)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
