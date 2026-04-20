import type { CSSProperties } from "react";

/**
 * Recharts tooltip shell — token-driven, high contrast in light and dark UI.
 */
export function rechartsTooltipContentStyle(): CSSProperties {
  return {
    backgroundColor: "var(--tooltip-bg)",
    color: "var(--tooltip-fg)",
    border: "1px solid var(--tooltip-border)",
    borderRadius: "10px",
    fontSize: 13,
    lineHeight: 1.45,
    padding: "10px 14px",
    boxShadow: "var(--tooltip-shadow)",
    opacity: 1,
  };
}

export function rechartsTooltipItemStyle(): CSSProperties {
  return {
    color: "var(--tooltip-fg)",
    paddingTop: 2,
    paddingBottom: 2,
  };
}

export function rechartsTooltipLabelStyle(): CSSProperties {
  return {
    color: "var(--tooltip-fg)",
    fontWeight: 600,
    marginBottom: 4,
  };
}
