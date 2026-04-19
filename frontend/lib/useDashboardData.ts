import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiUrl } from "./config";

export interface ApiAccount {
  id: string;
  account_name: string;
  account_purpose?: string;
  cash_balance: number | string;
  clerk_user_id?: string;
}

export interface ApiInstrument {
  symbol: string;
  name?: string;
  current_price?: number | string;
  allocation_asset_class?: Record<string, number>;
  instrument_type?: string;
}

export interface ApiPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number | string;
  instrument?: ApiInstrument | null;
}

export interface ApiJob {
  id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  request_payload?: {
    _orch?: {
      trace_id?: string;
      pipeline?: Record<
        string,
        {
          status?: string;
          at?: string | null;
          error?: string;
          detail?: string;
        }
      >;
    };
  };
  report_payload?: { content?: string; agent?: string; generated_at?: string };
  summary_payload?: Record<string, unknown>;
  charts_payload?: unknown;
  retirement_payload?: unknown;
  error_message?: string;
  error?: string;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function useDashboardData(
  enabled: boolean,
  getToken: () => Promise<string | null>
) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [positionsByAccount, setPositionsByAccount] = useState<
    Record<string, ApiPosition[]>
  >({});
  const [instruments, setInstruments] = useState<Record<string, ApiInstrument>>(
    {}
  );
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
    }
  }, [enabled]);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      const userRes = await fetch(`${getApiUrl()}/api/user`, { headers });
      if (!userRes.ok) {
        throw new Error(`Failed to load profile (${userRes.status})`);
      }
      const userJson = (await userRes.json()) as {
        user?: Record<string, unknown>;
        user_id?: string;
      };
      if (userJson.user) setUser(userJson.user);
      else if (userJson.user_id)
        setUser({ clerk_user_id: userJson.user_id });
      else setUser(null);

      const accountsRes = await fetch(`${getApiUrl()}/api/accounts`, { headers });
      if (!accountsRes.ok) {
        throw new Error(`Failed to load accounts (${accountsRes.status})`);
      }
      const accountsData: ApiAccount[] = await accountsRes.json();
      const list = Array.isArray(accountsData) ? accountsData : [];
      setAccounts(list);

      const posMap: Record<string, ApiPosition[]> = {};
      const instMap: Record<string, ApiInstrument> = {};

      for (const acc of list) {
        if (!acc.id) continue;
        const pr = await fetch(`${getApiUrl()}/api/accounts/${acc.id}/positions`, {
          headers,
        });
        if (pr.ok) {
          const pj = await pr.json();
          const plist: ApiPosition[] = pj.positions || [];
          posMap[acc.id] = plist;
          for (const p of plist) {
            if (p.instrument && p.symbol) {
              instMap[p.symbol] = p.instrument as ApiInstrument;
            }
          }
        } else {
          posMap[acc.id] = [];
        }
      }
      setPositionsByAccount(posMap);
      setInstruments(instMap);

      const jobsRes = await fetch(`${getApiUrl()}/api/jobs`, { headers });
      if (jobsRes.ok) {
        const jobsJson = await jobsRes.json();
        setJobs(jobsJson.jobs || []);
      } else {
        setJobs([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [enabled, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const onDone = () => void load();
    window.addEventListener("analysis:completed", onDone);
    return () => window.removeEventListener("analysis:completed", onDone);
  }, [enabled, load]);

  const totalPositionsCount = useMemo(
    () =>
      Object.values(positionsByAccount).reduce((s, arr) => s + arr.length, 0),
    [positionsByAccount]
  );

  const { totalValue, assetClassBreakdown } = useMemo(() => {
    const breakdown: Record<string, number> = {
      equity: 0,
      fixed_income: 0,
      alternatives: 0,
      cash: 0,
    };
    let total = 0;

    for (const account of accounts) {
      const cash = toNumber(account.cash_balance);
      total += cash;
      breakdown.cash += cash;
    }

    for (const arr of Object.values(positionsByAccount)) {
      for (const position of arr) {
        const instrument = instruments[position.symbol];
        const price = instrument ? toNumber(instrument.current_price) : 0;
        const qty = toNumber(position.quantity);
        const positionValue = price * qty;
        if (positionValue <= 0) continue;
        total += positionValue;

        const alloc = instrument?.allocation_asset_class;
        if (alloc && typeof alloc === "object") {
          for (const [assetClass, pct] of Object.entries(alloc)) {
            const p = toNumber(pct);
            if (p <= 0) continue;
            const slice = (positionValue * p) / 100;
            breakdown[assetClass] = (breakdown[assetClass] || 0) + slice;
          }
        }
      }
    }

    return { totalValue: total, assetClassBreakdown: breakdown };
  }, [accounts, positionsByAccount, instruments]);

  const latestCompletedJob = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "completed");
    completed.sort((a, b) => {
      const ta = new Date(a.completed_at || a.created_at).getTime();
      const tb = new Date(b.completed_at || b.created_at).getTime();
      return tb - ta;
    });
    return completed[0] ?? null;
  }, [jobs]);

  const mostRecentJob = useMemo(() => {
    if (!jobs.length) return null;
    const sorted = [...jobs].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted[0] ?? null;
  }, [jobs]);

  const lastAnalysisLabel = useMemo(() => {
    if (!latestCompletedJob) return null;
    const raw = latestCompletedJob.completed_at || latestCompletedJob.created_at;
    if (!raw) return null;
    return new Date(raw).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [latestCompletedJob]);

  return {
    user,
    accounts,
    positionsByAccount,
    instruments,
    jobs,
    latestCompletedJob,
    mostRecentJob,
    lastAnalysisLabel,
    loading,
    error,
    refetch: load,
    totalPositionsCount,
    totalValue,
    assetClassBreakdown,
  };
}
