import { LandingSection } from "./LandingSection";

const donut = [
  { label: "Equity", pct: 58, color: "var(--chart-1)" },
  { label: "Fixed income", pct: 24, color: "var(--chart-2)" },
  { label: "Cash", pct: 9, color: "var(--chart-3)" },
  { label: "Alternatives", pct: 9, color: "var(--chart-6)" },
] as const;

/** Pre-baked heat intensities 0–1 for a 6×8 grid (illustrative). */
const heatCells: number[][] = [
  [0.15, 0.22, 0.35, 0.48, 0.72, 0.88, 0.62, 0.28],
  [0.12, 0.18, 0.42, 0.55, 0.78, 0.92, 0.58, 0.32],
  [0.2, 0.28, 0.38, 0.52, 0.65, 0.82, 0.7, 0.4],
  [0.25, 0.32, 0.45, 0.6, 0.7, 0.75, 0.55, 0.38],
  [0.18, 0.24, 0.5, 0.68, 0.85, 0.8, 0.5, 0.22],
  [0.1, 0.16, 0.3, 0.44, 0.58, 0.72, 0.48, 0.2],
];

function heatColor(t: number): string {
  const r = Math.round(40 + t * 80);
  const g = Math.round(70 + t * 60);
  const b = Math.round(120 + t * 90);
  return `rgb(${r},${g},${b})`;
}

export default function VisualProofMocks() {
  let start = 0;
  const circumference = 2 * Math.PI * 44;
  const segments = donut.map((d) => {
    const len = (d.pct / 100) * circumference;
    const seg = { ...d, offset: start, len };
    start += len;
    return seg;
  });

  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      pad="lg"
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
        Intelligence at a glance
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
        Illustrative visualizations; your workspace renders the same structures on live portfolio data.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Allocation donut */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Allocation
          </p>
          <div className="mt-4 flex items-center gap-6">
            <div className="relative h-[112px] w-[112px] shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {segments.map((s) => (
                  <circle
                    key={s.label}
                    r="44"
                    cx="50"
                    cy="50"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="12"
                    strokeDasharray={`${s.len} ${circumference - s.len}`}
                    strokeDashoffset={-s.offset}
                  />
                ))}
              </svg>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-xs">
              {donut.map((d) => (
                <li key={d.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.label}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">{d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Risk heatmap */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Factor risk heatmap
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
            Rows: sleeve · Columns: factor load
          </p>
          <div className="mt-4 grid grid-cols-8 gap-1">
            {heatCells.flat().map((cell, i) => (
              <div
                key={i}
                className="aspect-square rounded-sm"
                style={{ backgroundColor: heatColor(cell) }}
                title={`${Math.round(cell * 100)}`}
              />
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
            Max cell 92 · Min cell 10
          </p>
        </div>

        {/* Retirement trajectory */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Retirement trajectory
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
            Real assets · $M · Age 45 to 90
          </p>
          <svg viewBox="0 0 280 140" className="mt-3 h-36 w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="ret-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(76,130,251,0.35)" />
                <stop offset="100%" stopColor="rgba(76,130,251,0)" />
              </linearGradient>
            </defs>
            <line x1="36" y1="12" x2="36" y2="118" stroke="var(--chart-grid)" strokeWidth="1" />
            <line x1="36" y1="118" x2="268" y2="118" stroke="var(--chart-grid)" strokeWidth="1" />
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="36"
                y1={28 + i * 30}
                x2="268"
                y2={28 + i * 30}
                stroke="var(--chart-grid)"
                strokeWidth="0.5"
                opacity="0.5"
              />
            ))}
            <path
              d="M 36 95 L 72 88 L 108 76 L 144 62 L 180 48 L 216 38 L 252 32 L 268 30"
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2"
            />
            <path
              d="M 36 95 L 72 88 L 108 76 L 144 62 L 180 48 L 216 38 L 252 32 L 268 30 L 268 118 L 36 118 Z"
              fill="url(#ret-fill)"
            />
            <path
              d="M 36 102 L 72 98 L 108 92 L 144 88 L 180 86 L 216 88 L 252 94 L 268 102"
              fill="none"
              stroke="var(--chart-3)"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
            <text x="38" y="132" fill="var(--chart-axis)" fontSize="9" fontFamily="system-ui">
              45
            </text>
            <text x="248" y="132" fill="var(--chart-axis)" fontSize="9" fontFamily="system-ui">
              90
            </text>
            <text x="4" y="22" fill="var(--chart-axis)" fontSize="9" fontFamily="system-ui">
              4.2
            </text>
            <text x="4" y="72" fill="var(--chart-axis)" fontSize="9" fontFamily="system-ui">
              2.8
            </text>
          </svg>
          <div className="mt-1 flex flex-wrap gap-4 text-[10px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[var(--chart-1)]" />
              Base case
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t border-dashed border-[var(--chart-3)]" />
              Downside path
            </span>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
