export const THEME_STORAGE_KEY = "alexfin-theme";

export type ThemePreference = "light" | "dark" | "system";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
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
