import Link from 'next/link';
import Head from 'next/head';
import { pageTitle } from '@/lib/brand';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>{pageTitle("404")}</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <h1 className="mb-4 text-5xl font-bold text-[var(--accent)]">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
            Page Not Found
          </h2>
          <p className="mb-8 text-[var(--text-secondary)]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/dashboard">
            <button
              type="button"
              className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-95"
            >
              Return to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}