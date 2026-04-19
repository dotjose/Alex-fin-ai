import { useAuth, useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Hero from "../components/dashboard/Hero";
import Insights from "../components/dashboard/Insights";
import PortfolioChart from "../components/dashboard/PortfolioChart";
import Accounts from "../components/dashboard/Accounts";
import InstitutionalDashboardCharts from "../components/dashboard/InstitutionalDashboardCharts";
import { getApiUrl } from "../lib/config";
import {
  emitAnalysisCompleted,
  emitAnalysisFailed,
  emitAnalysisStarted,
} from "../lib/events";
import { showToast } from "../components/Toast";
import { fetchCapabilities } from "../lib/capabilities";
import { useDashboardData } from "../lib/useDashboardData";
import { DASHBOARD_HEADING, pageTitle } from "@/lib/brand";
import type { ApiJob } from "@/lib/useDashboardData";

export default function Dashboard() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const enabled = Boolean(userLoaded && user);
  const {
    user: profile,
    accounts,
    positionsByAccount,
    instruments,
    jobs,
    latestCompletedJob,
    mostRecentJob,
    lastAnalysisLabel,
    loading,
    error,
    refetch,
    totalPositionsCount,
    totalValue,
    assetClassBreakdown,
  } = useDashboardData(enabled, getToken);

  const recentFailedJob =
    mostRecentJob?.status === "failed" ? mostRecentJob : null;

  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [liveJob, setLiveJob] = useState<ApiJob | null>(null);
  const [analyzeCapability, setAnalyzeCapability] = useState<boolean | null>(null);
  const [mockLambdas, setMockLambdas] = useState(false);
  const [analysisRunStartedAt, setAnalysisRunStartedAt] = useState<number | null>(
    null
  );
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailRef = useRef(0);

  useEffect(() => {
    void fetchCapabilities()
      .then((c) => {
        setAnalyzeCapability(c.analyze_enabled);
        setMockLambdas(Boolean(c.mock_lambdas));
      })
      .catch(() => {
        setAnalyzeCapability(false);
        setMockLambdas(false);
      });
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  useEffect(() => {
    if (!enabled) {
      clearPoll();
      setAnalysisRunning(false);
      setLiveJob(null);
      setAnalysisRunStartedAt(null);
    }
  }, [enabled, clearPoll]);

  const onRunAnalysis = useCallback(async () => {
    clearPoll();
    if (accounts.length === 0) {
      showToast("error", "Add an account before running analysis.");
      return;
    }
    try {
      pollFailRef.current = 0;
      const token = await getToken();
      if (!token) {
        showToast("error", "Not authenticated");
        return;
      }
      setAnalysisRunning(true);
      setLiveJob(null);
      setAnalysisRunStartedAt(null);
      const res = await fetch(`${getApiUrl()}/api/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ analysis_type: "portfolio", options: {} }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Could not start analysis"
        );
      }
      const body = await res.json();
      const jobId = body.job_id as string;
      emitAnalysisStarted(jobId);
      setAnalysisRunStartedAt(Date.now());

      const tick = async () => {
        try {
          const t = await getToken();
          if (!t) {
            clearPoll();
            setAnalysisRunning(false);
            setLiveJob(null);
            setAnalysisRunStartedAt(null);
            return;
          }
          const jr = await fetch(`${getApiUrl()}/api/jobs/${jobId}`, {
            headers: {
              Authorization: `Bearer ${t}`,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });
          if (!jr.ok) {
            clearPoll();
            setAnalysisRunning(false);
            setLiveJob(null);
            setAnalysisRunStartedAt(null);
            return;
          }
          const job = (await jr.json()) as ApiJob;
          setLiveJob(job);
          if (job.status === "completed") {
            clearPoll();
            setAnalysisRunning(false);
            setLiveJob(null);
            setAnalysisRunStartedAt(null);
            emitAnalysisCompleted(jobId);
            showToast("success", "Analysis complete");
            void refetch();
          } else if (job.status === "failed") {
            clearPoll();
            setAnalysisRunning(false);
            setLiveJob(null);
            setAnalysisRunStartedAt(null);
            const errMsg =
              typeof job.error_message === "string"
                ? job.error_message
                : typeof job.error === "string"
                  ? job.error
                  : "Analysis failed";
            emitAnalysisFailed(jobId, errMsg);
            showToast("error", errMsg);
            void refetch();
          }
        } catch {
          if (pollFailRef.current < 3) {
            pollFailRef.current += 1;
            window.setTimeout(() => void tick(), 1200);
          }
        }
      };

      clearPoll();
      void tick();
      pollTimer.current = setInterval(() => void tick(), 2200);
    } catch (e) {
      setAnalysisRunning(false);
      setLiveJob(null);
      setAnalysisRunStartedAt(null);
      clearPoll();
      showToast(
        "error",
        e instanceof Error ? e.message : "Could not start analysis"
      );
    }
  }, [accounts.length, clearPoll, getToken, refetch]);

  const displayName =
    profile && typeof profile.display_name === "string"
      ? profile.display_name
      : null;

  return (
    <>
      <Head>
        <title>{pageTitle(DASHBOARD_HEADING)}</title>
      </Head>
      <Layout>
        <div className="mx-auto max-w-[1200px] px-6 py-10 lg:py-12">
          <header className="mb-10 lg:mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {DASHBOARD_HEADING}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {displayName ? `Welcome, ${displayName}` : "Overview"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Figures below are computed from accounts and positions returned by
              your API. Empty sections mean no data was returned yet.
            </p>
          </header>

          {error && !loading ? (
            <div
              className="mb-8 rounded-xl border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] px-4 py-3 text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <Hero
            loading={loading}
            accountCount={accounts.length}
            totalPortfolioValue={totalValue}
            assetClassBreakdown={assetClassBreakdown}
            lastAnalysisLabel={lastAnalysisLabel}
            analysisRunning={analysisRunning}
            liveJob={liveJob}
            recentFailedJob={recentFailedJob}
            analyzeCapability={analyzeCapability}
            mockLambdas={mockLambdas}
            analysisRunStartedAt={analysisRunStartedAt}
            onRunAnalysis={() => void onRunAnalysis()}
          />

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <Insights
              loading={loading}
              job={latestCompletedJob}
              failedJob={!latestCompletedJob ? recentFailedJob : null}
            />
            <PortfolioChart
              loading={loading}
              totalPositionsCount={totalPositionsCount}
              assetClassBreakdown={assetClassBreakdown}
              totalValue={totalValue}
            />
          </div>

          <InstitutionalDashboardCharts
            loading={loading}
            jobs={jobs}
            positionsByAccount={positionsByAccount}
            instruments={instruments}
            assetClassBreakdown={assetClassBreakdown}
            totalValue={totalValue}
            profile={profile as Record<string, unknown> | null}
            latestCompletedJob={latestCompletedJob}
          />

          <div className="mt-10">
            <Accounts
              loading={loading}
              accounts={accounts}
              positionsByAccount={positionsByAccount}
            />
          </div>
        </div>
      </Layout>
    </>
  );
}
