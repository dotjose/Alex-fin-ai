/** Central product copy — use for titles, nav, and metadata. */

export const BRAND_NAME = "AlexFin.ai";

/** Short line for meta description and SEO. */
export const PRODUCT_SUBTITLE =
  "AI Financial Intelligence Platform — portfolio analysis and retirement modeling backed by your data.";

/** Primary hero headline (single H1 on marketing). */
export const HERO_HEADLINE = "AI-powered wealth intelligence";

/** Hero supporting line under the headline. */
export const HERO_SUBHEADLINE =
  "Portfolio analysis, allocation context, and retirement modeling with multi-agent reasoning on your data.";

export const DASHBOARD_HEADING = "Portfolio Intelligence";

export function pageTitle(segment: string): string {
  return `${segment} — ${BRAND_NAME}`;
}
