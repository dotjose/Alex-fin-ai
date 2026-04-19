import {
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";
import {
  BRAND_NAME,
  CTA_TRY_SAMPLE,
  CTA_VIEW_INTELLIGENCE,
  HERO_HEADLINE,
  HERO_SUBHEADLINE,
} from "@/lib/brand";
import { HeroIntelPanel } from "./HeroIntelPanel";
import { HeroMarketBackground } from "./HeroMarketBackground";
import { LandingSection } from "./LandingSection";

export default function LandingHero() {
  return (
    <LandingSection className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg)]" pad="lg">
      <HeroMarketBackground />
      <div className="relative z-[1] grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            {BRAND_NAME}
            <span className="mx-2 text-[var(--border)]">·</span>
            <span className="text-[var(--text-primary)]">Wealth intelligence</span>
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl sm:leading-[1.12] lg:text-[2.5rem]">
            {HERO_HEADLINE}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-[17px]">
            {HERO_SUBHEADLINE}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <SignedOut>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
                >
                  {CTA_VIEW_INTELLIGENCE}
                </button>
              </SignUpButton>
              <Link
                href="#example-ai-insight"
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[rgba(76,130,251,0.45)]"
              >
                {CTA_TRY_SAMPLE}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
              >
                {CTA_VIEW_INTELLIGENCE}
              </Link>
              <Link
                href="#example-ai-insight"
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[rgba(76,130,251,0.45)]"
              >
                {CTA_TRY_SAMPLE}
              </Link>
            </SignedIn>
          </div>
        </div>
        <HeroIntelPanel />
      </div>
    </LandingSection>
  );
}
