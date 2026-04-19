import type { SVGProps } from "react";

type Variant = "horizontal" | "icon";

const ACCENT = "#4C82FB";

/**
 * Abstract “A” + upward stroke. Badge uses theme tokens for light/dark shells.
 */
export function AlexFinLogo({
  variant = "horizontal",
  className = "",
  ...svg
}: SVGProps<SVGSVGElement> & { variant?: Variant }) {
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden
        {...svg}
      >
        <rect
          width="32"
          height="32"
          rx="7"
          fill="var(--logo-badge-bg, #eef2f7)"
          stroke="var(--logo-badge-border, #e6eaf0)"
          strokeWidth="1"
        />
        <path
          d="M16 6L8 24h3l2-5h6l2 5h3L16 6zm0 4.5L18.5 17h-5L16 10.5z"
          fill={ACCENT}
        />
        <path
          d="M22 8l4 3-4 3"
          stroke={ACCENT}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 140 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AlexFin.ai"
      {...svg}
    >
      <rect
        x="0"
        y="0"
        width="32"
        height="32"
        rx="7"
        fill="var(--logo-badge-bg, #eef2f7)"
        stroke="var(--logo-badge-border, #e6eaf0)"
        strokeWidth="1"
      />
      <path
        d="M16 6L8 24h3l2-5h6l2 5h3L16 6zm0 4.5L18.5 17h-5L16 10.5z"
        fill={ACCENT}
      />
      <path
        d="M22 8l4 3-4 3"
        stroke={ACCENT}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="40"
        y="21"
        fill="var(--text-primary, #0b0f14)"
        style={{ fontFamily: "system-ui, sans-serif", fontSize: "15px", fontWeight: 600 }}
      >
        AlexFin
      </text>
      <text
        x="98"
        y="21"
        fill={ACCENT}
        style={{ fontFamily: "system-ui, sans-serif", fontSize: "15px", fontWeight: 600 }}
      >
        .ai
      </text>
    </svg>
  );
}
