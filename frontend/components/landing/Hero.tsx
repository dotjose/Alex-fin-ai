import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";
import { BRAND_NAME, HERO_HEADLINE, HERO_SUBHEADLINE } from "@/lib/brand";
import HeroLivePreview from "./HeroLivePreview";
import { LandingSection } from "./LandingSection";

export default function LandingHero() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--bg)]"
      pad="lg"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            {BRAND_NAME}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl sm:leading-[1.12]">
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
                  Get started
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[var(--accent)]"
                >
                  Sign in
                </button>
              </SignInButton>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 transition hover:text-[var(--text-primary)] hover:underline"
              >
                View dashboard
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
              >
                View dashboard
              </Link>
            </SignedIn>
          </div>
        </div>
        <HeroLivePreview />
      </div>
    </LandingSection>
  );
}
