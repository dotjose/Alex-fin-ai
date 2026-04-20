import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  type ThemePreference,
  applyThemeClass,
  emitThemePreferenceChange,
  getStoredTheme,
  resolveTheme,
  subscribeToTheme,
} from "@/lib/themeStorage";

function syncMeta(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#0B0F14" : "#FFFFFF");
  }
}

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
  /** Single click: flip resolved appearance to explicit light or dark. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeSnapshot = {
  preference: ThemePreference;
  resolved: "light" | "dark";
};

const serverSnapshot: ThemeSnapshot = {
  preference: "dark",
  resolved: "dark",
};

/** `useSyncExternalStore` compares snapshots with `Object.is` — must reuse one object per value pair. */
let clientSnapshotCache: ThemeSnapshot | null = null;

function readThemeSnapshot(): ThemeSnapshot {
  if (typeof window === "undefined") return serverSnapshot;
  const preference = getStoredTheme();
  const resolved = resolveTheme(preference);
  if (
    clientSnapshotCache &&
    clientSnapshotCache.preference === preference &&
    clientSnapshotCache.resolved === resolved
  ) {
    return clientSnapshotCache;
  }
  clientSnapshotCache = { preference, resolved };
  return clientSnapshotCache;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeToTheme, readThemeSnapshot, () => serverSnapshot);

  useLayoutEffect(() => {
    applyThemeClass(state.resolved);
    syncMeta(state.resolved);
  }, [state.resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    const r = resolveTheme(p);
    applyThemeClass(r);
    syncMeta(r);
    emitThemePreferenceChange();
  }, []);

  const toggleTheme = useCallback(() => {
    const r = resolveTheme(getStoredTheme());
    const next: ThemePreference = r === "dark" ? "light" : "dark";
    setPreference(next);
  }, [setPreference]);

  const value = useMemo(
    () => ({
      preference: state.preference,
      resolved: state.resolved,
      setPreference,
      toggleTheme,
    }),
    [state.preference, state.resolved, setPreference, toggleTheme],
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
