import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Layout from '../components/Layout';
import { getApiUrl } from '../lib/config';
import Head from 'next/head';
import { pageTitle } from '@/lib/brand';
import type { ApiJob } from '@/lib/useDashboardData';
import {
  PIPELINE_LABELS,
  PIPELINE_ORDER,
  formatStepTime,
  pipelineChipClass,
  readPipeline,
} from '@/lib/analysisPipeline';
import { useRechartsTheme } from '@/lib/useRechartsTheme';

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
  request_payload?: ApiJob['request_payload'];
  report_payload?: {
    agent: string;
    content: string;
    generated_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  charts_payload?: Record<string, any> | null;  // Charter stores charts with dynamic keys
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
        <div className="min-h-screen bg-[var(--bg)] py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-12 text-center shadow-[var(--shadow-card)]">
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
        <div className="min-h-screen bg-[var(--bg)] py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-12 text-center shadow-[var(--shadow-card)]">
              <h2 className="mb-4 text-2xl font-bold text-[var(--text-primary)]">
                {fetchingLatest ? "Loading Latest Analysis..." : "No Analysis Available"}
              </h2>
              <p className="mb-6 text-[var(--text-secondary)]">
                {fetchingLatest
                  ? "Please wait while we load your latest analysis."
                  : "You have not completed any analyses yet. Start a new analysis to see results here."}
              </p>
              {!fetchingLatest && (
                <button
                  type="button"
                  onClick={() => router.push("/advisor-team")}
                  className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-95"
                >
                  Start New Analysis
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
        <div className="min-h-screen bg-[var(--bg)] py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-10 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Analysis in progress
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
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
                className="mt-8 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
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
        <div className="min-h-screen bg-[var(--bg)] py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-12 shadow-[var(--shadow-card)]">
              <h2 className="mb-4 text-2xl font-bold text-[var(--danger)]">Analysis Failed</h2>
              <p className="mb-4 text-[var(--text-secondary)]">
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
                className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-95"
              >
                Try Another Analysis
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  // Tab content renderers
  const renderOverview = () => {
    const report = job?.report_payload?.content;
    if (!report) {
      return (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          No portfolio report available.
        </div>
      );
    }

    return (
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            h1: ({children}) => <h1 className="text-3xl font-bold mb-4 text-[var(--text-primary)]">{children}</h1>,
            h2: ({children}) => <h2 className="text-2xl font-semibold mb-3 text-[var(--text-primary)] mt-6">{children}</h2>,
            h3: ({children}) => <h3 className="text-xl font-medium mb-2 text-[var(--text-secondary)] mt-4">{children}</h3>,
            ul: ({children}) => <ul className="list-disc ml-6 mb-4 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal ml-6 mb-4 space-y-1">{children}</ol>,
            li: ({children}) => <li className="text-[var(--text-secondary)]">{children}</li>,
            p: ({children}) => <p className="mb-4 text-[var(--text-secondary)] leading-relaxed">{children}</p>,
            table: ({children}) => (
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">{children}</table>
              </div>
            ),
            thead: ({children}) => <thead className="bg-[var(--surface)]">{children}</thead>,
            th: ({children}) => <th className="p-3 text-left font-semibold border border-[var(--border)]">{children}</th>,
            td: ({children}) => <td className="p-3 border border-[var(--border)]">{children}</td>,
            strong: ({children}) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-[var(--text-secondary)]">
                {children}
              </blockquote>
            ),
          }}
        >
          {report}
        </ReactMarkdown>
      </div>
    );
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {chartEntries.map(([key, chartData]: [string, any]) => {
          // Skip if no data
          if (!chartData?.data || chartData.data.length === 0) return null;

          const chartType = getChartType(chartData);
          const title = chartData.title || formatTitle(key);

          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)]"
            >
              <h3 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">{title}</h3>
              <ResponsiveContainer width="100%" height={300}>
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
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
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
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
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
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
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
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                    <Line type="monotone" dataKey="value" stroke={rt.series[0]} strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>

              {/* Add legend for pie/donut charts with many items */}
              {(chartType === 'pie' || chartType === 'donut') && chartData.data.length > 6 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {chartData.data.map((entry: any, idx: number) => (
                    <div key={entry.name} className="flex items-center text-sm">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                        backgroundColor:
                          entry.color || rt.series[idx % rt.series.length],
                      }}
                      />
                      <span className="text-[var(--text-secondary)]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
    const retirementAnalysis = retirement.analysis;

    return (
      <div className="space-y-8">
        {/* Analysis Section */}
        {retirementAnalysis && (
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] p-6">
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  h2: ({children}) => <h2 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">{children}</h2>,
                  h3: ({children}) => <h3 className="text-xl font-medium mb-2 text-[var(--text-secondary)]">{children}</h3>,
                  p: ({children}) => <p className="text-[var(--text-secondary)] leading-relaxed mb-4">{children}</p>,
                  strong: ({children}) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                  ul: ({children}) => <ul className="list-disc ml-6 mt-2 space-y-1">{children}</ul>,
                  li: ({children}) => <li className="text-[var(--text-secondary)]">{children}</li>,
                }}
              >
                {retirementAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <>
      <Head>
        <title>{pageTitle("Analysis")}</title>
      </Head>
      <Layout>
      <div className="min-h-screen bg-[var(--bg)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)] px-8 py-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Portfolio Analysis Results</h1>
                <p className="text-[var(--text-secondary)]">
                  Completed on {formatDate(job.created_at)}
                </p>
              </div>
              <button
                onClick={() => router.push('/advisor-team')}
                className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-95"
              >
                New Analysis
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)] mb-8">
            <div className="border-b border-[var(--border)]">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 px-8 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'overview'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`py-3 px-8 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'charts'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Charts
                </button>
                <button
                  onClick={() => setActiveTab('retirement')}
                  className={`py-3 px-8 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'retirement'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Retirement
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)] px-8 py-6">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'charts' && renderCharts()}
            {activeTab === 'retirement' && renderRetirement()}
          </div>
        </div>
      </div>
      </Layout>
    </>
  );
}