import { useAuth, useUser } from "@clerk/nextjs";
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import { PortfolioHoldingsLedger } from "../components/dashboard/PortfolioHoldingsLedger";
import { ActionBar } from "@/components/dashboard/v2/ActionBar";
import { AllocationChart } from "@/components/dashboard/v2/AllocationChart";
import { HeroSection } from "@/components/dashboard/v2/HeroSection";
import { HoldingsTable } from "@/components/dashboard/v2/HoldingsTable";
import { InsightCard } from "@/components/dashboard/v2/InsightCard";
import { PerformanceChart } from "@/components/dashboard/v2/PerformanceChart";
import { RiskSummaryCard } from "@/components/dashboard/v2/RiskSummaryCard";
import { SecondaryStrip } from "@/components/dashboard/v2/SecondaryStrip";
import { portfolioValueTimeline } from "@/lib/dashboardChartData";
import { useDashboardChartModel } from "@/lib/useDashboardChartModel";
import { useRechartsTheme } from "@/lib/useRechartsTheme";
import { requireApiUrl } from "../lib/config";
import {
  emitAnalysisCompleted,
  emitAnalysisFailed,
  emitAnalysisStarted,
} from "../lib/events";
import { showToast } from "../components/Toast";
import { fetchCapabilities } from "../lib/capabilities";
import { useDashboardData } from "../lib/useDashboardData";
import { riskBadgeFromPortfolio, riskScoreFromPortfolio } from "@/lib/dashboardRiskBadge";
import { DASHBOARD_HEADING, pageTitle } from "@/lib/brand";
import type { ApiJob, ApiPosition } from "@/lib/useDashboardData";
import { toNumber } from "@/lib/format";

export default function Dashboard() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const enabled = Boolean(userLoaded && user);
  const {
    user: profile,
    accounts,
    portfolioByAccount,
    positionsByAccount,
    instruments,
    jobs,
    latestCompletedJob,
    mostRecentJob,
    loading,
    sessionReady,
    error,
    refetch,
    totalPositionsCount,
    totalValue,
    assetClassBreakdown,
    updatePositionQuantity,
    deletePosition,
    createPosition,
    createAccount,
  } = useDashboardData(enabled, getToken);

  const recentFailedJob = mostRecentJob?.status === "failed" ? mostRecentJob : null;

  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [liveJob, setLiveJob] = useState<ApiJob | null>(null);
  const [analyzeCapability, setAnalyzeCapability] = useState<boolean | null>(null);
  const [analysisRunStartedAt, setAnalysisRunStartedAt] = useState<number | null>(null);
  const [analysisSlow, setAnalysisSlow] = useState(false);
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [signalAddAccount, setSignalAddAccount] = useState(0);
  const [signalAddPosition, setSignalAddPosition] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailRef = useRef(0);

  const riskBadge = useMemo(
    () => riskBadgeFromPortfolio(assetClassBreakdown, totalValue, totalPositionsCount),
    [assetClassBreakdown, totalValue, totalPositionsCount],
  );

  const derivedRiskScore = useMemo(
    () => riskScoreFromPortfolio(assetClassBreakdown, totalValue, totalPositionsCount),
    [assetClassBreakdown, totalValue, totalPositionsCount],
  );

  const { perfSeries, performanceDeltaPct } = useMemo(() => {
    const tl = portfolioValueTimeline(jobs, totalValue);
    if (tl.length < 2) return { perfSeries: tl, performanceDeltaPct: null as number | null };
    const a = tl[tl.length - 2]!.value;
    const b = tl[tl.length - 1]!.value;
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b)) return { perfSeries: tl, performanceDeltaPct: null };
    return { perfSeries: tl, performanceDeltaPct: ((b - a) / a) * 100 };
  }, [jobs, totalValue]);

  const chartModel = useDashboardChartModel({
    totalPositionsCount,
    assetClassBreakdown,
    totalValue,
    jobs,
  });
  const rt = useRechartsTheme();

  useEffect(() => {
    void fetchCapabilities()
      .then((c) => {
        setAnalyzeCapability(c.analyze_enabled);
      })
      .catch(() => {
        setAnalyzeCapability(false);
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
      setAnalysisSlow(false);
      setAnalysisTimedOut(false);
    }
  }, [enabled, clearPoll]);

  useEffect(() => {
    if (!analysisRunning || analysisRunStartedAt == null) {
      setAnalysisSlow(false);
      return;
    }
    const t = window.setTimeout(() => setAnalysisSlow(true), 10_000);
    return () => window.clearTimeout(t);
  }, [analysisRunning, analysisRunStartedAt]);

  useEffect(() => {
    if (!analysisRunning || analysisRunStartedAt == null) return;
    const t = window.setTimeout(() => {
      clearPoll();
      setAnalysisRunning(false);
      setLiveJob(null);
      setAnalysisRunStartedAt(null);
      setAnalysisSlow(false);
      setAnalysisTimedOut(true);
      showToast(
        "error",
        "Stopped waiting for this run. Open the analysis workspace to confirm job status.",
      );
    }, 180_000);
    return () => window.clearTimeout(t);
  }, [analysisRunning, analysisRunStartedAt, clearPoll]);

  const onRunAnalysis = useCallback(async () => {
    clearPoll();
    setAnalysisTimedOut(false);
    setAnalysisSlow(false);
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
      const res = await fetch(`${requireApiUrl()}/api/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ analysis_type: "portfolio", options: {} }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Could not start analysis");
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
          const jr = await fetch(`${requireApiUrl()}/api/jobs/${jobId}`, {
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
            setAnalysisSlow(false);
            emitAnalysisCompleted(jobId);
            showToast("success", "Analysis complete");
            void refetch();
          } else if (job.status === "failed") {
            clearPoll();
            setAnalysisRunning(false);
            setLiveJob(null);
            setAnalysisRunStartedAt(null);
            setAnalysisSlow(false);
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
      setAnalysisSlow(false);
      clearPoll();
      showToast("error", e instanceof Error ? e.message : "Could not start analysis");
    }
  }, [accounts.length, clearPoll, getToken, refetch]);

  const displayName =
    profile && typeof profile.display_name === "string" ? profile.display_name : null;

  const onQuantityCommit = useCallback(
    async (accountId: string, position: ApiPosition, raw: string) => {
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) return;
      if (Math.abs(n - toNumber(position.quantity)) < 1e-9) return;
      try {
        await updatePositionQuantity(accountId, position.id, n);
      } catch {
        showToast("error", "Could not update quantity");
      }
    },
    [updatePositionQuantity],
  );

  const onDeletePosition = useCallback(
    (accountId: string, positionId: string) => {
      void deletePosition(accountId, positionId).catch(() => showToast("error", "Could not remove position"));
    },
    [deletePosition],
  );

  const dashBusy = loading || !sessionReady;

  const analyzeDisabled = analyzeCapability === false;
  const analyzeDisabledReason =
    analyzeCapability === false
      ? "Analysis is disabled for this deployment."
      : analyzeCapability === null
        ? "Checking whether analysis is available…"
        : undefined;

  return (
    <>
      <Head>
        <title>{pageTitle("Portfolio")}</title>
      </Head>
      <Layout>
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          <HeroSection
            displayName={displayName}
            totalValue={totalValue}
            dailyChangePct={performanceDeltaPct}
            portfolioScore={totalValue > 0 ? derivedRiskScore : null}
            loading={dashBusy}
          />

          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {displayName ? `${displayName} · ${DASHBOARD_HEADING}` : DASHBOARD_HEADING}
          </p>

          {dashBusy && !error ? (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
              Initializing your workspace…
            </p>
          ) : null}

          {error && !loading ? (
            <div
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {recentFailedJob && !dashBusy ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
              Last run failed
              {typeof recentFailedJob.error_message === "string"
                ? `: ${recentFailedJob.error_message}`
                : "."}{" "}
              <Link href="/analysis" className="font-semibold underline underline-offset-2">
                Open workspace
              </Link>
            </div>
          ) : null}

          <div className="mt-6">
            <ActionBar
              onRunAnalysis={() => void onRunAnalysis()}
              onAddPosition={() => setSignalAddPosition((n) => n + 1)}
              onAddAccount={() => setSignalAddAccount((n) => n + 1)}
              analysisRunning={analysisRunning}
              analyzeDisabled={
                analyzeDisabled || analyzeCapability === null || dashBusy
              }
              analyzeDisabledReason={
                dashBusy
                  ? "Loading your workspace…"
                  : analyzeDisabledReason
              }
            />
          </div>

          {analysisRunning ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
              <span className="font-semibold">Analysis in progress</span>
              {liveJob?.status ? ` · ${liveJob.status}` : null}
              {analysisSlow ? " · Taking longer than usual…" : null}
              {analysisTimedOut ? " · Timed out waiting; confirm status in the workspace." : null}
            </div>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-10">
            <div className="min-w-0 space-y-6 lg:col-span-7">
              <HoldingsTable
                loading={dashBusy}
                accounts={accounts}
                portfolioByAccount={portfolioByAccount}
                instruments={instruments}
                positionsByAccount={positionsByAccount}
                onQuantityCommit={onQuantityCommit}
                onDelete={(accountId, positionId) => onDeletePosition(accountId, positionId)}
              />
              <PerformanceChart data={perfSeries} rt={rt} loading={dashBusy} />
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-3">
              <InsightCard
                loading={dashBusy}
                job={latestCompletedJob}
                accounts={accounts}
                portfolioByAccount={portfolioByAccount}
              />
              <AllocationChart model={chartModel} rt={rt} loading={dashBusy} />
              <RiskSummaryCard
                riskScore={totalValue > 0 ? derivedRiskScore : null}
                riskBadge={riskBadge}
                loading={dashBusy}
              />
            </div>
          </div>

          <div className="mt-8">
            <SecondaryStrip
              loading={dashBusy}
              accounts={accounts}
              portfolioByAccount={portfolioByAccount}
              positionsByAccount={positionsByAccount}
              jobs={jobs}
            />
          </div>

          <PortfolioHoldingsLedger
            modalsOnly
            loading={dashBusy}
            accounts={accounts}
            portfolioByAccount={portfolioByAccount}
            positionsByAccount={positionsByAccount}
            instruments={instruments}
            updatePositionQuantity={updatePositionQuantity}
            deletePosition={deletePosition}
            createPosition={createPosition}
            createAccount={createAccount}
            signalOpenAddAccount={signalAddAccount}
            signalOpenAddPosition={signalAddPosition}
          />
        </div>
      </Layout>
    </>
  );
}
