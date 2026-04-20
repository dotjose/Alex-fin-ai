export const THEME_STORAGE_KEY = "alexfin-theme";
/** Legacy key — migrated once into `alexfin-theme`. */
const LEGACY_THEME_STORAGE_KEY = "theme";

export type ThemePreference = "light" | "dark" | "system";

const themeListeners = new Set<() => void>();

/** Notify `useSyncExternalStore` subscribers after same-tab preference writes. */
export function emitThemePreferenceChange() {
  themeListeners.forEach((fn) => fn());
}

/** Subscribe to theme-related updates (storage, OS scheme, html.dark mutations). */
export function subscribeToTheme(onStoreChange: () => void) {
  themeListeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      themeListeners.delete(onStoreChange);
    };
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY || e.key === LEGACY_THEME_STORAGE_KEY) onStoreChange();
  };
  const onScheme = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onScheme);
  const obs = new MutationObserver(onStoreChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return () => {
    themeListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
    mq.removeEventListener("change", onScheme);
    obs.disconnect();
  };
}

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
    const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy === "dark" || legacy === "light") {
      localStorage.setItem(THEME_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemeClass(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/** Inline script for _document: run before React to avoid theme flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k)||'dark';var d=v==='dark'||(v==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(v==='light')d=false;if(d)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
