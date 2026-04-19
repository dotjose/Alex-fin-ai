import { useEffect, useMemo, useState } from "react";

export type RechartsTheme = {
  textSecondary: string;
  textPrimary: string;
  grid: string;
  accent: string;
  danger: string;
  warning: string;
  series: string[];
  highlight: string;
};

function readChartTheme(): RechartsTheme {
  if (typeof document === "undefined") {
    return {
      textSecondary: "#6B7280",
      textPrimary: "#111827",
      grid: "#E5E7EB",
      accent: "#4C82FB",
      danger: "#EF4444",
      warning: "#F2C94C",
      series: [
        "#4C82FB",
        "#2D62D8",
        "#7A8FA3",
        "#5B6573",
        "#94A3B8",
        "#C5CCD6",
      ],
      highlight: "#F2C94C",
    };
  }
  const s = getComputedStyle(document.documentElement);
  const g = (k: string) => s.getPropertyValue(k).trim();
  const series = [
    g("--chart-1"),
    g("--chart-2"),
    g("--chart-3"),
    g("--chart-4"),
    g("--chart-5"),
    g("--chart-6"),
  ].filter(Boolean);
  return {
    textSecondary: g("--text-secondary") || "#5B6573",
    textPrimary: g("--text-primary") || "#0B0F14",
    grid: g("--chart-grid") || g("--border") || "#E6EAF0",
    accent: g("--accent") || "#4C82FB",
    danger: g("--danger") || "#EF4444",
    warning: g("--warning") || "#F2C94C",
    series: series.length ? series : ["#4C82FB", "#2D62D8"],
    highlight: g("--chart-highlight") || "#F2C94C",
  };
}

/**
 * Re-reads when `html.dark` toggles so Recharts picks up light/dark tokens.
 */
export function useRechartsTheme(): RechartsTheme {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTick((t) => t + 1));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    const onStorage = (e: StorageEvent) => {
      if (e.key === "alexfin-theme") setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // `tick` intentionally forces re-read when `html.dark` toggles.
  return useMemo(() => {
    void tick;
    return readChartTheme();
  }, [tick]);
}
