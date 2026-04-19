/**
 * Illustrative intelligence shell with fixed sample figures (no empty states).
 */
export function HeroIntelPanel() {
  const rows = [
    { label: "Equity", pct: 58 },
    { label: "Fixed income", pct: 24 },
    { label: "Cash", pct: 9 },
    { label: "Alternatives", pct: 9 },
  ] as const;

  return (
    <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        Illustrative aggregate
      </p>
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Total portfolio value
          </span>
          <span className="font-mono text-sm font-medium tabular-nums text-[var(--text-primary)]">
            $2,847,300
          </span>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          Allocation
        </p>
        <ul className="mt-3 space-y-2">
          {rows.map(({ label, pct }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
              <div className="h-2 flex-1 max-w-[200px] overflow-hidden rounded-full bg-[rgba(230,234,240,0.06)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs tabular-nums text-[var(--text-primary)]">
                {pct}%
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[rgba(76,130,251,0.06)] px-3 py-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Risk score
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              61
              <span className="ml-2 text-xs font-sans font-medium text-[var(--text-secondary)]">
                / 100
              </span>
            </p>
          </div>
          <span className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-medium text-[var(--warning)]">
            Moderate–elevated
          </span>
        </div>
      </div>
    </div>
  );
}
