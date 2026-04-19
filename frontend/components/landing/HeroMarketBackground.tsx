/**
 * Subtle market-style backdrop: grid + repeating price path (decorative only).
 */
export function HeroMarketBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="landing-hero-grid absolute inset-0 opacity-[0.55]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 70% 20%, rgba(76, 130, 251, 0.09), transparent 55%)",
        }}
      />
      <svg
        className="landing-hero-chart-line absolute -bottom-8 left-0 h-[min(42vh,320px)] w-[200%] max-w-none opacity-[0.35]"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="landing-hero-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(76,130,251,0.15)" />
            <stop offset="50%" stopColor="rgba(76,130,251,0.55)" />
            <stop offset="100%" stopColor="rgba(107,156,255,0.2)" />
          </linearGradient>
        </defs>
        <path
          d="M0,120 C80,118 120,40 200,70 S360,150 440,95 S560,30 640,75 S780,140 860,88 S1000,20 1080,55 S1160,95 1200,85"
          fill="none"
          stroke="url(#landing-hero-line)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0,145 C100,130 160,165 260,125 S420,85 520,115 S680,165 780,105 S920,55 1020,95 S1120,130 1200,118"
          fill="none"
          stroke="rgba(154,164,178,0.25)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
