import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { resolved, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={toggleTheme}
      title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:scale-95"
    >
      {resolved === "dark" ? (
        <Sun className="h-5 w-5" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
