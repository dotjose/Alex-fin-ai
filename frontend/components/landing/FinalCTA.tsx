import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { LandingSection } from "./LandingSection";

export default function FinalCTA() {
  return (
    <LandingSection
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      pad="md"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-base font-medium leading-relaxed text-[var(--text-primary)] sm:text-lg">
          Start analyzing your portfolio with AI-driven financial intelligence.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
    </LandingSection>
  );
}
