"use client";

import type { ReactNode } from "react";

export type ChartTooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

type CustomTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayload[];
  /** Extra rows under the primary value */
  footer?: ReactNode;
  valueFormatter?: (v: number) => string;
};

/**
 * Recharts tooltip shell — Tailwind dark: + light surfaces; never use default Recharts tooltip.
 */
export function DashboardChartTooltip({
  active,
  label,
  payload,
  footer,
  valueFormatter,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const raw = row?.value;
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  const formatted =
    valueFormatter && Number.isFinite(num)
      ? valueFormatter(num)
      : Number.isFinite(num)
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(num)
        : String(raw ?? "—");

  return (
    <div
      className="pointer-events-none z-50 max-w-[min(100vw-24px,280px)] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10"
      style={{ boxShadow: "var(--tooltip-shadow, 0 18px 48px rgba(0,0,0,0.2))" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label != null && label !== "" ? String(label) : row?.name ?? ""}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatted}</p>
      {footer ? <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">{footer}</div> : null}
    </div>
  );
}
