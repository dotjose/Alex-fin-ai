import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Layout from "../components/Layout";
import { pageTitle } from "@/lib/brand";

/**
 * Accounts and positions are managed on the main portfolio dashboard.
 * This route keeps bookmarks working and sends users to the unified surface.
 */
export default function AccountsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/dashboard#holdings");
  }, [router]);

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
