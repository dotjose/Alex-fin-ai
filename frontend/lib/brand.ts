/** Central product copy — use for titles, nav, and metadata. */

export const BRAND_NAME = "AlexFin.ai";

/** Short line for meta description and SEO. */
export const PRODUCT_SUBTITLE =
  "AI wealth intelligence for allocation, risk, retirement trajectory, and multi-account portfolio analysis.";

/** Primary hero headline (single H1 on marketing). */
export const HERO_HEADLINE = "Understand your portfolio like a hedge fund — in seconds.";

/** Hero supporting line under the headline. */
export const HERO_SUBHEADLINE =
  "Allocation clarity, concentration risk, retirement projections, and institutional-grade reasoning, built from your connected accounts.";

/** Primary marketing CTA label. */
export const CTA_VIEW_INTELLIGENCE = "View your portfolio intelligence";

/** Secondary marketing CTA (scroll / sample path). */
export const CTA_TRY_SAMPLE = "Try with sample portfolio";

export const DASHBOARD_HEADING = "Portfolio Intelligence";

export function pageTitle(segment: string): string {
  return `${segment} — ${BRAND_NAME}`;
}
