import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Layout from "../../components/Layout";
import { pageTitle } from "@/lib/brand";

/**
 * Per-account editing lives on the portfolio dashboard (expand the account in Holdings).
 */
export default function AccountDetailRedirectPage() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof id !== "string" || !id) return;
    void router.replace(`/dashboard?account=${encodeURIComponent(id)}#holdings`);
  }, [router, id]);

  return (
    <>
      <Head>
        <title>{pageTitle("Portfolio")}</title>
      </Head>
      <Layout>
        <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Opening portfolio…</p>
      </Layout>
    </>
  );
}
