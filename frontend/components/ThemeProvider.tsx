import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const stored = getStoredTheme();
    setPreferenceState(stored);
    const r = resolveTheme(stored);
    setResolved(r);
    applyThemeClass(r);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const r = resolveTheme(preference);
    setResolved(r);
    applyThemeClass(r);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        r === "dark" ? "#0B0F14" : "#F7F9FC"
      );
    }
  }, [preference, mounted]);

  useEffect(() => {
    if (!mounted || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyThemeClass(r);
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [preference, mounted]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    const r = resolveTheme(p);
    setResolved(r);
    applyThemeClass(r);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: "light" as ThemePreference,
      resolved: "light" as const,
      setPreference: () => {},
    };
  }
  return ctx;
}
