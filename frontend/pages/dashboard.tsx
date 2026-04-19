import { useAuth, useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import AnalysisControlCard from "../components/dashboard/AnalysisControlCard";
import Accounts from "../components/dashboard/Accounts";
import { AccountsSummaryCard } from "../components/dashboard/AccountsSummaryCard";
import { DashboardActivityCard } from "../components/dashboard/DashboardActivityCard";
import { DashboardAllocationPanel } from "../components/dashboard/DashboardChartPanels";
import { DashboardHeroKpis } from "../components/dashboard/DashboardHeroKpis";
import { DashboardPerformanceCard } from "../components/dashboard/DashboardPerformanceCard";
import Insights from "../components/dashboard/Insights";
import { AppPageHero } from "@/components/shell/AppPageHero";
import { portfolioValueTimeline } from "@/lib/dashboardChartData";
import { useDashboardChartModel } from "@/lib/useDashboardChartModel";
import { useRechartsTheme } from "@/lib/useRechartsTheme";
import { getApiUrl } from "../lib/config";
import {
  emitAnalysisCompleted,
  emitAnalysisFailed,
  emitAnalysisStarted,
} from "../lib/events";
import { showToast } from "../components/Toast";
import { fetchCapabilities } from "../lib/capabilities";
import { useDashboardData } from "../lib/useDashboardData";
import { riskBadgeFromPortfolio } from "@/lib/dashboardRiskBadge";
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
  const [analysisSlow, setAnalysisSlow] = useState(false);
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [dataFreshAt, setDataFreshAt] = useState<Date | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailRef = useRef(0);

  useEffect(() => {
    if (!loading && enabled) {
      setDataFreshAt(new Date());
    }
  }, [loading, enabled]);

  const riskBadge = useMemo(
    () => riskBadgeFromPortfolio(assetClassBreakdown, totalValue, totalPositionsCount),
    [assetClassBreakdown, totalValue, totalPositionsCount]
  );

  const performanceDeltaPct = useMemo(() => {
    const tl = portfolioValueTimeline(jobs, totalValue);
    if (tl.length < 2) return null;
    const a = tl[tl.length - 2]!.value;
    const b = tl[tl.length - 1]!.value;
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b)) return null;
    return ((b - a) / a) * 100;
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
    return () => clearTimeout(t);
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
        "Stopped waiting for this run. Open the analysis workspace to confirm job status."
      );
    }, 180_000);
    return () => clearTimeout(t);
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
        <div className="ds-page pb-[var(--space-12)] pt-[var(--space-2)]">
          <AppPageHero
            title="Dashboard"
            subtitle={
              displayName ? `${displayName} · ${DASHBOARD_HEADING}` : DASHBOARD_HEADING
            }
            kpi={
              <DashboardHeroKpis
                loading={loading}
                totalValue={totalValue}
                accountCount={accounts.length}
                riskBadge={riskBadge}
              />
            }
          />

          {error && !loading ? (
            <div
              className="mt-[var(--space-6)] rounded-[12px] border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] p-[var(--space-4)] text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="ds-shell mt-[var(--space-6)]">
            <div className="ds-grid-item min-w-0 ds-shell-span-12">
              <AnalysisControlCard
                recentFailedJob={recentFailedJob}
                analysisRunning={analysisRunning}
                liveJob={liveJob}
                analyzeCapability={analyzeCapability}
                mockLambdas={mockLambdas}
                analysisRunStartedAt={analysisRunStartedAt}
                analysisSlow={analysisSlow}
                analysisTimedOut={analysisTimedOut}
                onRunAnalysis={() => void onRunAnalysis()}
              />
            </div>
          </div>

          {loading ? (
            <>
              <div className="ds-shell mt-[var(--space-6)]">
                <div className="ds-grid-item ds-shell-span-6 h-[var(--dash-row-height)] animate-pulse rounded-[12px] border border-[var(--border)] bg-[var(--surface)]" />
                <div className="ds-grid-item ds-shell-span-6 h-[var(--dash-row-height)] animate-pulse rounded-[12px] border border-[var(--border)] bg-[var(--surface)]" />
              </div>
              <div className="ds-shell mt-[var(--space-6)]">
                <div className="ds-grid-item ds-shell-span-4 h-[var(--dash-row-height)] animate-pulse rounded-[12px] border border-[var(--border)] bg-[var(--surface)]" />
                <div className="ds-grid-item ds-shell-span-4 h-[var(--dash-row-height)] animate-pulse rounded-[12px] border border-[var(--border)] bg-[var(--surface)]" />
                <div className="ds-grid-item ds-shell-span-4 h-[var(--dash-row-height)] animate-pulse rounded-[12px] border border-[var(--border)] bg-[var(--surface)]" />
              </div>
            </>
          ) : (
            <>
              <div className="ds-shell mt-[var(--space-6)]">
                <div className="ds-grid-item min-w-0 ds-shell-span-6">
                  <DashboardAllocationPanel model={chartModel} rt={rt} />
                </div>
                <div className="ds-grid-item min-w-0 ds-shell-span-6">
                  <Insights
                    loading={false}
                    job={latestCompletedJob}
                    failedJob={!latestCompletedJob ? recentFailedJob : null}
                    analysisRunning={analysisRunning}
                    analysisSlow={analysisSlow}
                    liveJob={liveJob}
                    analysisRunStartedAt={analysisRunStartedAt}
                    fillCell
                  />
                </div>
              </div>

              <div className="ds-shell mt-[var(--space-6)]">
                <div className="ds-grid-item min-w-0 ds-shell-span-4">
                  <AccountsSummaryCard
                    loading={false}
                    accounts={accounts}
                    positionsByAccount={positionsByAccount}
                    instruments={instruments}
                  />
                </div>
                <div className="ds-grid-item min-w-0 ds-shell-span-4">
                  <DashboardPerformanceCard
                    model={chartModel}
                    performanceDeltaPct={performanceDeltaPct}
                    lastAnalysisLabel={lastAnalysisLabel}
                    loading={false}
                  />
                </div>
                <div className="ds-grid-item min-w-0 ds-shell-span-4">
                  <DashboardActivityCard loading={false} jobs={jobs} />
                </div>
              </div>
            </>
          )}

          {!loading ? (
            <div className="mt-[var(--space-8)] min-w-0">
              <p className="ds-caption">Full ledger</p>
              <Accounts
                loading={loading}
                accounts={accounts}
                positionsByAccount={positionsByAccount}
                instruments={instruments}
                dataFreshAt={dataFreshAt}
                onSync={() => void refetch()}
                cardClassName="mt-[var(--space-4)]"
              />
            </div>
          ) : null}
        </div>
      </Layout>
    </>
  );
}
