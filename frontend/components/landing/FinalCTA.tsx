import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { CTA_VIEW_INTELLIGENCE } from "@/lib/brand";
import { LandingSection } from "./LandingSection";

export default function FinalCTA() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--card)]"
      pad="md"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-base font-medium leading-relaxed text-[var(--text-primary)] sm:text-lg">
          Bring the same rigor institutions use to personal wealth: allocation discipline, risk
          transparency, and retirement clarity, without another generic chat surface.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SignedOut>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
              >
                {CTA_VIEW_INTELLIGENCE}
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition duration-200 hover:border-[rgba(76,130,251,0.45)]"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:opacity-95"
            >
              {CTA_VIEW_INTELLIGENCE}
            </Link>
          </SignedIn>
        </div>
      </div>
    </LandingSection>
  );
}
