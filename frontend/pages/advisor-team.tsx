import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import Layout from '../components/Layout';
import { getApiUrl } from '../lib/config';
import { fetchCapabilities } from '../lib/capabilities';
import { emitAnalysisCompleted, emitAnalysisFailed, emitAnalysisStarted } from '../lib/events';
import Head from 'next/head';
import { pageTitle } from '@/lib/brand';

interface Agent {
  icon: string;
  name: string;
  role: string;
  description: string;
  color: string;
  bgColor: string;
}

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
}

interface AnalysisProgress {
  stage: 'idle' | 'starting' | 'planner' | 'parallel' | 'completing' | 'complete' | 'error';
  message: string;
  activeAgents: string[];
  error?: string;
}

const agents: Agent[] = [
  {
    icon: '🎯',
    name: 'Financial Planner',
    role: 'Orchestrator',
    description: 'Coordinates your financial analysis',
    color: 'text-ai-accent',
    bgColor: 'bg-ai-accent'
  },
  {
    icon: '📊',
    name: 'Portfolio Analyst',
    role: 'Reporter',
    description: 'Analyzes your holdings and performance',
    color: 'text-primary',
    bgColor: 'bg-primary'
  },
  {
    icon: '📈',
    name: 'Chart Specialist',
    role: 'Charter',
    description: 'Visualizes your portfolio composition',
    color: 'text-green-600',
    bgColor: 'bg-green-600'
  },
  {
    icon: '🎯',
    name: 'Retirement Planner',
    role: 'Retirement',
    description: 'Projects your retirement readiness',
    color: 'text-accent',
    bgColor: 'bg-accent'
  }
];

export default function AdvisorTeam() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    message: '',
    activeAgents: []
  });
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [analyzeCapability, setAnalyzeCapability] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchCapabilities()
      .then((c) => setAnalyzeCapability(c.analyze_enabled))
      .catch(() => setAnalyzeCapability(false));
  }, []);

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkJobStatusLocal = async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${getApiUrl()}/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const job = await response.json();

          if (job.status === 'completed') {
            setProgress({
              stage: 'complete',
              message: 'Analysis complete!',
              activeAgents: []
            });

            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }

            // Emit completion event so other components can refresh
            emitAnalysisCompleted(jobId);

            // Also refresh our own jobs list
            fetchJobs();

            setTimeout(() => {
              router.push(`/analysis?job_id=${jobId}`);
            }, 1500);
          } else if (job.status === 'failed') {
            setProgress({
              stage: 'error',
              message: 'Analysis failed',
              activeAgents: [],
              error: job.error || 'Analysis encountered an error'
            });

            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }

            // Emit failure event
            emitAnalysisFailed(jobId, job.error);

            setIsAnalyzing(false);
            setCurrentJobId(null);
          }
        }
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    };

    if (currentJobId && !pollInterval) {
      const interval = setInterval(() => {
        checkJobStatusLocal(currentJobId);
      }, 2000);
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, pollInterval, router]);

  const fetchJobs = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress({
      stage: 'starting',
      message: 'Initializing analysis...',
      activeAgents: []
    });

    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          analysis_type: 'portfolio',
          options: {}
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentJobId(data.job_id);

        // Emit start event
        emitAnalysisStarted(data.job_id);

        setProgress({
          stage: 'planner',
          message: 'Financial Planner coordinating analysis...',
          activeAgents: ['Financial Planner']
        });

        setTimeout(() => {
          setProgress({
            stage: 'parallel',
            message: 'Agents working in parallel...',
            activeAgents: ['Portfolio Analyst', 'Chart Specialist', 'Retirement Planner']
          });
        }, 5000);
      } else {
        const errBody = await response.json().catch(() => ({}));
        const detail =
          typeof errBody.detail === 'string'
            ? errBody.detail
            : Array.isArray(errBody.detail)
              ? errBody.detail.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(' ')
              : `HTTP ${response.status}`;
        throw new Error(detail || 'Failed to start analysis');
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      setProgress({
        stage: 'error',
        message: 'Failed to start analysis',
        activeAgents: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsAnalyzing(false);
      setCurrentJobId(null);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-[var(--success)]";
      case "failed":
        return "text-[var(--danger)]";
      case "running":
        return "text-[var(--accent)]";
      default:
        return "text-[var(--text-secondary)]";
    }
  };

  const isAgentActive = (agentName: string) => {
    return progress.activeAgents.includes(agentName);
  };

  return (
    <>
      <Head>
        <title>{pageTitle("Advisor team")}</title>
      </Head>
      <Layout>
      <div className="min-h-screen bg-[var(--bg)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-6 shadow-[var(--shadow-card)]">
            <h1 className="mb-2 text-3xl font-bold text-[var(--text-primary)]">
              Your AI Advisory Team
            </h1>
            <p className="text-[var(--text-secondary)]">
              Meet your team of specialized AI agents that work together to provide comprehensive financial analysis.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] transition-shadow duration-200 ${
                  isAgentActive(agent.name) ? "ring-2 ring-[var(--accent)]" : ""
                }`}
              >
                {isAgentActive(agent.name) ? (
                  <div className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" />
                ) : null}
                <div className="relative">
                  <div className={`mb-4 text-5xl ${isAgentActive(agent.name) ? "opacity-90" : ""}`}>
                    {agent.icon}
                  </div>
                  <h3 className={`mb-1 text-xl font-semibold ${agent.color}`}>
                    {agent.name}
                  </h3>
                  <p className="mb-3 text-sm text-[var(--text-secondary)]">{agent.role}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{agent.description}</p>
                  {isAgentActive(agent.name) && (
                    <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white ${agent.bgColor} animate-pulse`}>
                      <span className="mr-2">●</span>
                      Active
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-6 shadow-[var(--shadow-card)]">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Analysis Center</h2>
                {analyzeCapability === false ? (
                  <p className="mt-2 max-w-xl text-sm text-[var(--warning)]">
                    Queue unavailable: set{" "}
                    <code className="rounded bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-1 text-xs">
                      SQS_QUEUE_URL
                    </code>{" "}
                    on the API (README). Deployed stacks get this from Terraform.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={startAnalysis}
                disabled={isAnalyzing || analyzeCapability !== true}
                title={
                  analyzeCapability === true
                    ? undefined
                    : "Configure SQS_QUEUE_URL on the API before starting analysis."
                }
                className={`shrink-0 rounded-lg px-8 py-4 font-semibold text-white transition-opacity ${
                  isAnalyzing || analyzeCapability !== true
                    ? "cursor-not-allowed bg-[var(--border)] opacity-70"
                    : "bg-[var(--accent)] shadow-[var(--shadow-card)] hover:opacity-95"
                }`}
              >
                {isAnalyzing ? "Analysis in Progress..." : "Start New Analysis"}
              </button>
            </div>

            {isAnalyzing && (
              <div className="mb-8 rounded-lg border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Analysis Progress</h3>
                  {progress.stage !== "error" && progress.stage !== "complete" ? (
                    <div className="flex space-x-2">
                      <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                      <div className="h-2 w-2 rounded-full bg-[var(--accent)] opacity-70" />
                      <div className="h-2 w-2 rounded-full bg-[var(--accent)] opacity-50" />
                    </div>
                  ) : null}
                </div>

                <p
                  className={`mb-4 text-sm ${
                    progress.stage === "error"
                      ? "text-[var(--danger)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {progress.message}
                </p>

                {progress.stage === "error" && progress.error && (
                  <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] p-4">
                    <p className="text-sm text-[var(--danger)]">{progress.error}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAnalyzing(false);
                        setCurrentJobId(null);
                        setProgress({ stage: "idle", message: "", activeAgents: [] });
                      }}
                      className="mt-3 rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {progress.stage !== "idle" && progress.stage !== "error" && (
                  <div className="h-2 w-full rounded-full bg-[var(--border)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)] transition-all duration-500"
                      style={{
                        width: progress.stage === 'starting' ? '10%' :
                               progress.stage === 'planner' ? '30%' :
                               progress.stage === 'parallel' ? '70%' :
                               progress.stage === 'completing' ? '90%' :
                               '100%'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Previous Analyses</h3>
              {jobs.length === 0 ? (
                <p className="italic text-[var(--text-secondary)]">
                  No previous analyses found. Start your first analysis above!
                </p>
              ) : (
                <div className="space-y-3">
                  {jobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Analysis #{job.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {formatDate(job.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`text-sm font-medium ${getStatusColor(job.status)}`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                        {job.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => router.push(`/analysis?job_id=${job.id}`)}
                            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </Layout>
    </>
  );
}