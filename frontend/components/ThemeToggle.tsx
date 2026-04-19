import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/lib/themeStorage";

const cycle: ThemePreference[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { preference, setPreference } = useTheme();

  if (!ready) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
        aria-hidden
      />
    );
  }
  const next = () => {
    const i = cycle.indexOf(preference);
    setPreference(cycle[(i + 1) % cycle.length]);
  };

  const label =
    preference === "light"
      ? "Light theme"
      : preference === "dark"
        ? "Dark theme"
        : "Match system";

  return (
    <button
      type="button"
      onClick={next}
      title={`Theme: ${label} (click to cycle)`}
      aria-label={`Theme: ${label}. Click to cycle light, dark, and system.`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
    >
      {preference === "light" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : preference === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 14.5A8.5 8.5 0 0111.5 3 8.5 8.5 0 1017 19.5 6 6 0 0021 14.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M7 9h4M7 13h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
