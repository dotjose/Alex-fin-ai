import { useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/themeStorage";

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
      textSecondary: "#64748B",
      textPrimary: "#0F172A",
      grid: "#E5E7EB",
      accent: "#2563EB",
      danger: "#DC2626",
      warning: "#D97706",
      series: ["#2563EB", "#16A34A", "#64748B", "#7C3AED", "#0EA5E9", "#C026D3"],
      highlight: "#D97706",
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
    textPrimary: g("--text-primary") || "#0F172A",
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
      if (e.key === THEME_STORAGE_KEY || e.key === "theme") setTick((t) => t + 1);
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
