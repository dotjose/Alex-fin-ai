import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Layout from "../components/Layout";
import { getApiUrl } from "../lib/config";
import Head from "next/head";
import { pageTitle } from "@/lib/brand";
import type { ApiJob } from "@/lib/useDashboardData";
import { DsCard, DsChartContainer } from "@/components/ds";
import { AppPageHero } from "@/components/shell/AppPageHero";
import { StructuredJobOverview } from "@/components/analysis/StructuredJobOverview";
import { MarkdownBriefPanel } from "@/components/analysis/MarkdownBriefPanel";
import {
  PIPELINE_LABELS,
  PIPELINE_ORDER,
  formatStepTime,
  pipelineChipClass,
  readPipeline,
} from '@/lib/analysisPipeline';
import {
  rechartsTooltipContentStyle,
  rechartsTooltipItemStyle,
  rechartsTooltipLabelStyle,
} from "@/lib/rechartsTooltipStyle";
import { useRechartsTheme } from "@/lib/useRechartsTheme";

const chartTooltipProps = {
  contentStyle: rechartsTooltipContentStyle(),
  itemStyle: rechartsTooltipItemStyle(),
  labelStyle: rechartsTooltipLabelStyle(),
} as const;

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
  request_payload?: ApiJob["request_payload"];
  summary_payload?: ApiJob["summary_payload"];
  report_payload?: {
    agent: string;
    content: string;
    generated_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  charts_payload?: Record<string, any> | null; // Charter stores charts with dynamic keys
  retirement_payload?: {
    agent: string;
    analysis: string;
    generated_at: string;
  };
  error_message?: string;
  error?: string;
}

interface JobListItem {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
}

type TabType = 'overview' | 'charts' | 'retirement';

export default function Analysis() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { job_id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const rt = useRechartsTheme();

  const refreshJob = useCallback(
    async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${getApiUrl()}/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const jobData = (await response.json()) as Job;
          setJob(jobData);
        }
      } catch {
        /* ignore */
      }
    },
    [getToken]
  );

  useEffect(() => {
    const loadJob = async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${getApiUrl()}/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const jobData = await response.json();
          setJob(jobData);
        } else {
          console.error('Failed to fetch job');
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadLatestJob = async () => {
      setFetchingLatest(true);
      try {
        const token = await getToken();
        // First, get the list of jobs to find the latest completed one
        const response = await fetch(`${getApiUrl()}/api/jobs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const jobs: JobListItem[] = data.jobs || [];
          // Find the latest completed job
          const latestCompletedJob = jobs
            .filter(j => j.status === 'completed')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          if (latestCompletedJob) {
            // Load the full job details
            await loadJob(latestCompletedJob.id);
            // Update the URL to include the job_id without causing a page reload
            router.replace(`/analysis?job_id=${latestCompletedJob.id}`, undefined, { shallow: true });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching latest job:', error);
        setLoading(false);
      } finally {
        setFetchingLatest(false);
      }
    };

    if (job_id) {
      loadJob(job_id as string);
    } else if (router.isReady) {
      // Router is ready but no job_id provided - fetch the latest analysis
      loadLatestJob();
    }
  }, [job_id, router.isReady, getToken, router]);

  const pollJobId = job?.id;
  const pollStatus = job?.status;
  useEffect(() => {
    if (
      !pollJobId ||
      (pollStatus !== "running" && pollStatus !== "pending")
    ) {
      return;
    }
    const id = window.setInterval(() => void refreshJob(pollJobId), 2500);
    return () => window.clearInterval(id);
  }, [pollJobId, pollStatus, refreshJob]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="ds-page min-h-screen min-w-0 bg-[var(--bg)] py-[var(--space-8)]">
          <div className="min-w-0">
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-[var(--space-8)] py-[var(--space-12)] text-center shadow-[var(--shadow-card)]">
              <div className="animate-pulse">
                <div className="mx-auto mb-4 h-8 w-1/3 rounded bg-[var(--border)]" />
                <div className="mx-auto h-4 w-1/2 rounded bg-[var(--border)]" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="ds-page min-h-screen min-w-0 bg-[var(--bg)] py-[var(--space-8)]">
          <div className="min-w-0">
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-[var(--space-8)] py-[var(--space-12)] text-center shadow-[var(--shadow-card)]">
              <h2 className="ds-h2 mb-[var(--space-4)]">
                {fetchingLatest ? "Loading latest analysis…" : "No analysis available"}
              </h2>
              <p className="ds-body mb-[var(--space-6)] text-[var(--text-secondary)]">
                {fetchingLatest
                  ? "Please wait while we load your latest analysis."
                  : "You have not completed any analyses yet. Start a new analysis to see results here."}
              </p>
              {!fetchingLatest && (
                <button
                  type="button"
                  onClick={() => router.push("/advisor-team")}
                  className="ds-btn-primary px-[var(--space-6)] py-3"
                >
                  Start new analysis
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (job.status === "running" || job.status === "pending") {
    const pipeline = readPipeline(job as ApiJob);
    return (
      <Layout>
        <div className="ds-page min-h-screen min-w-0 bg-[var(--bg)] py-[var(--space-8)]">
          <div className="min-w-0">
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-[var(--space-8)] py-[var(--space-8)] shadow-[var(--shadow-card)]">
              <h2 className="ds-h2">Analysis in progress</h2>
              <p className="ds-body mt-[var(--space-2)] text-[var(--text-secondary)]">
                Stages update as the worker reports pipeline progress.
              </p>
              <ul className="mt-8 max-w-lg space-y-2">
                {PIPELINE_ORDER.map((key) => {
                  const step = pipeline[key];
                  const status = step?.status ?? "pending";
                  const label = PIPELINE_LABELS[key];
                  const t = formatStepTime(step?.at);
                  const done = status === "completed";
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition-opacity duration-200"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                            done
                              ? "border-[color-mix(in_srgb,var(--success)_50%,var(--border))] text-[var(--success)]"
                              : "border-[var(--border)] text-[var(--text-secondary)]"
                          }`}
                          aria-hidden
                        >
                          {done ? "✓" : ""}
                        </span>
                        {label}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {t ? (
                          <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">
                            {t}
                          </span>
                        ) : null}
                        <span className={pipelineChipClass(status)}>{status}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => void refreshJob(job.id)}
                className="ds-btn-primary mt-[var(--space-8)] px-[var(--space-6)] py-2.5"
              >
                Refresh status
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (job.status === "failed") {
    return (
      <Layout>
        <div className="ds-page min-h-screen min-w-0 bg-[var(--bg)] py-[var(--space-8)]">
          <div className="min-w-0">
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-[var(--space-8)] py-[var(--space-12)] shadow-[var(--shadow-card)]">
              <h2 className="ds-h2 mb-[var(--space-4)] text-[var(--danger)]">Analysis failed</h2>
              <p className="ds-body mb-[var(--space-4)] text-[var(--text-secondary)]">
                The analysis encountered an error and could not be completed.
              </p>
              {job.error_message && (
                <div className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] p-4">
                  <p className="text-sm text-[var(--danger)]">{job.error_message}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push("/advisor-team")}
                className="ds-btn-primary px-[var(--space-6)] py-3"
              >
                Try another analysis
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  // Tab content renderers
  const renderOverview = () => {
    const report = job?.report_payload?.content?.trim();
    const summary = job?.summary_payload;
    const hasSummary = summary && typeof summary === "object" && Object.keys(summary).length > 0;
    if (!report && !hasSummary) {
      return (
        <div className="py-12 text-center text-[var(--text-secondary)]">No portfolio report available.</div>
      );
    }
    return <StructuredJobOverview job={job as ApiJob} />;
  };

  const renderCharts = () => {
    const chartsPayload = job?.charts_payload;
    if (!chartsPayload || Object.keys(chartsPayload).length === 0) {
      return (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          No chart data available.
        </div>
      );
    }

    // Helper function to format chart title from key
    const formatTitle = (key: string): string => {
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // Helper function to determine chart type based on data structure or chart metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getChartType = (chartData: any): 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line' => {
      // If the charter agent specifies a type, use it directly if supported
      if (chartData.type) {
        const supportedTypes = ['pie', 'donut', 'bar', 'horizontalBar', 'line'];
        if (supportedTypes.includes(chartData.type)) {
          return chartData.type;
        }
        // Map variations to supported types
        const typeMap: Record<string, 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line'> = {
          'column': 'bar',
          'area': 'line'
        };
        if (typeMap[chartData.type]) {
          return typeMap[chartData.type];
        }
      }

      // Otherwise, make an intelligent guess based on the data
      // If data has dates/time series, use line chart
      if (chartData.data?.[0]?.date || chartData.data?.[0]?.year) return 'line';

      // If data represents parts of a whole (has percentages or small dataset), use pie
      if (chartData.data?.length <= 10 && chartData.data?.[0]?.value) return 'pie';

      // Default to bar chart for other cases
      return 'bar';
    };

    // Dynamically render all charts provided by the charter agent
    const chartEntries = Object.entries(chartsPayload);

    return (
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {chartEntries.map(([key, chartData]: [string, any]) => {
          // Skip if no data
          if (!chartData?.data || chartData.data.length === 0) return null;

          const chartType = getChartType(chartData);
          const title = chartData.title || formatTitle(key);

          const legend =
            (chartType === "pie" || chartType === "donut") && chartData.data.length > 6 ? (
              <div className="grid max-w-full grid-cols-2 gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {chartData.data.map((entry: any, idx: number) => (
                  <div key={entry.name} className="flex min-w-0 items-center text-sm">
                    <div
                      className="mr-2 h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: entry.color || rt.series[idx % rt.series.length],
                      }}
                    />
                    <span className="min-w-0 truncate text-[var(--text-secondary)]">{entry.name}</span>
                  </div>
                ))}
              </div>
            ) : null;

          return (
            <DsChartContainer key={key} title={title} minHeight={300} footer={legend}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'pie' || chartType === 'donut' ? (
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label
                      outerRadius={100}
                      innerRadius={chartType === 'donut' ? 60 : 0}  // Donut has inner radius
                      fill={rt.series[0]}
                      dataKey="value"
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data.map((entry: any, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={entry.color || rt.series[idx % rt.series.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
                    />
                  </PieChart>
                ) : chartType === 'horizontalBar' ? (
                  // For horizontal bars, just use regular vertical bars with rotated labels
                  // Recharts horizontal layout can be problematic
                  <BarChart
                    data={chartData.data}
                    margin={{ left: 10, right: 30, top: 5, bottom: 60 }}
                  >
                    <CartesianGrid
                      stroke={rt.grid}
                      strokeDasharray="3 3"
                      strokeOpacity={0.65}
                    />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
                    />
                    <Bar dataKey="value">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || rt.series[index % rt.series.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData.data}>
                    <CartesianGrid
                      stroke={rt.grid}
                      strokeDasharray="3 3"
                      strokeOpacity={0.65}
                    />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
                    />
                    <Bar dataKey="value" fill={chartData.color || rt.series[0]} />
                  </BarChart>
                ) : (
                  // Line chart for time series data
                  <LineChart data={chartData.data}>
                    <CartesianGrid
                      stroke={rt.grid}
                      strokeDasharray="3 3"
                      strokeOpacity={0.65}
                    />
                    <XAxis dataKey={chartData.xKey || "year"} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
                    />
                    <Line type="monotone" dataKey="value" stroke={rt.series[0]} strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </DsChartContainer>
          );
        })}
      </div>
    );
  };

  const renderRetirement = () => {
    const retirement = job?.retirement_payload;
    if (!retirement) {
      return (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          No retirement projection available.
        </div>
      );
    }

    // Backend provides 'analysis' as markdown text
    const retirementAnalysis = retirement.analysis?.trim();
    if (!retirementAnalysis) {
      return (
        <div className="py-12 text-center text-[var(--text-secondary)]">No retirement narrative available.</div>
      );
    }

    return (
      <MarkdownBriefPanel
        title="Retirement projection"
        description="Structured from the retirement agent output. Open the full report for tables and detail."
        markdown={retirementAnalysis}
        modalTitle="Full retirement analysis"
      />
    );
  };

  return (
    <>
      <Head>
        <title>{pageTitle("Analysis")}</title>
      </Head>
      <Layout>
        <div className="ds-page min-h-screen min-w-0 bg-[var(--bg)] py-[var(--space-8)]">
          <AppPageHero
            title="Portfolio analysis"
            subtitle={`Completed ${formatDate(job.created_at)}`}
            actions={
              <button
                type="button"
                onClick={() => router.push("/advisor-team")}
                className="ds-btn-primary min-h-0 py-2.5"
              >
                New analysis
              </button>
            }
          />

          <div className="ds-shell">
            <DsCard padding="none" className="ds-shell-span-12 overflow-hidden shadow-[var(--shadow-card)]">
              <div className="min-w-0 border-b border-[var(--border)]">
                <nav className="-mb-px flex min-w-0 flex-wrap gap-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className="ds-tab px-5 py-3 text-sm font-medium sm:px-8"
                    data-active={activeTab === "overview" ? "true" : "false"}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("charts")}
                    className="ds-tab px-5 py-3 text-sm font-medium sm:px-8"
                    data-active={activeTab === "charts" ? "true" : "false"}
                  >
                    Charts
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("retirement")}
                    className="ds-tab px-5 py-3 text-sm font-medium sm:px-8"
                    data-active={activeTab === "retirement" ? "true" : "false"}
                  >
                    Retirement
                  </button>
                </nav>
              </div>
            </DsCard>

            <DsCard
              padding="lg"
              className="ds-shell-span-12 min-h-0 shadow-[var(--shadow-card)]"
            >
              <div className="min-w-0 max-h-[min(70vh,720px)] overflow-y-auto">
                {activeTab === "overview" && renderOverview()}
                {activeTab === "charts" && renderCharts()}
                {activeTab === "retirement" && renderRetirement()}
              </div>
            </DsCard>
          </div>
        </div>
      </Layout>
    </>
  );
}