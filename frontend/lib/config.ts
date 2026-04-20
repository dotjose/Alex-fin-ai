/**
 * Public API base URL for browser fetch calls.
 * Must be evaluated at request time (not only at module load) so SSR/hydration
 * does not pin an empty string when `window` was undefined during import.
 */
export function getApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://localhost:8000";
    }
    return "";
  }
  return "http://localhost:8000";
}

/** Use before authenticated API calls; fails fast with a clear configuration error. */
export function requireApiUrl(): string {
  const base = getApiUrl().trim();
  if (!base) {
    throw new Error(
      "API base URL is empty. Set NEXT_PUBLIC_API_URL to your FastAPI origin (e.g. https://api.example.com).",
    );
  }
  return base;
}
