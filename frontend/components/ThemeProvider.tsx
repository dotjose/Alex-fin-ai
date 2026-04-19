import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  type ThemePreference,
  applyThemeClass,
  getStoredTheme,
  resolveTheme,
} from "@/lib/themeStorage";

function syncMeta(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#0B0F17" : "#FFFFFF");
  }
}

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
  /** Single-click: flip between light and dark (explicit preference, no cycle). */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  const setPreference = useCallback((p: ThemePreference) => {
    const r = resolveTheme(p);
    applyThemeClass(r);
    setResolved(r);
    setPreferenceState(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    syncMeta(r);
  }, []);

  useLayoutEffect(() => {
    const stored = getStoredTheme();
    const r = resolveTheme(stored);
    applyThemeClass(r);
    setResolved(r);
    setPreferenceState(stored);
    syncMeta(r);
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyThemeClass(r);
      syncMeta(r);
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [preference, mounted]);

  const toggleTheme = useCallback(() => {
    const next: ThemePreference = resolved === "dark" ? "light" : "dark";
    setPreference(next);
  }, [resolved, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggleTheme }),
    [preference, resolved, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: "dark" as ThemePreference,
      resolved: "dark" as const,
      setPreference: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
