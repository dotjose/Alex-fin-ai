import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiUrl } from "./config";

export type CreateAccountInput = {
  account_name: string;
  account_purpose?: string;
  cash_balance: number;
};

export type CreatePositionInput = {
  account_id: string;
  symbol: string;
  quantity: number;
};

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

/** GET /api/accounts/{id}/portfolio — server-computed marks and weights */
export type ApiPortfolioHolding = {
  position_id: string;
  symbol: string;
  quantity: number;
  average_price: number | null;
  current_price: number | null;
  value: number;
  weight: number | null;
  price_status: string;
};

export type ApiPortfolioSnapshot = {
  account_id: string;
  cash_balance: number;
  total_positions_value: number;
  total_value: number;
  positions_count: number;
  holdings: ApiPortfolioHolding[];
};

export type PortfolioSummary = {
  cash_balance: number;
  holdings_value: number;
  total_value: number;
};

/** POST/PUT /api/positions structured response */
export type PositionMutationResponse = {
  position: ApiPosition;
  account: ApiAccount;
  summary: PortfolioSummary;
};

function isPositionMutationEnvelope(
  raw: unknown,
): raw is PositionMutationResponse {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Boolean(o.position && o.account && o.summary);
}

export interface ApiJob {
  id: string;
  status: string;
  created_at: string;
  job_type?: string;
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
  const [portfolioByAccount, setPortfolioByAccount] = useState<
    Record<string, ApiPortfolioSnapshot>
  >({});
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

      const instMap: Record<string, ApiInstrument> = {};
      const instRes = await fetch(`${getApiUrl()}/api/instruments`, { headers });
      if (instRes.ok) {
        const instRows = (await instRes.json()) as unknown;
        if (Array.isArray(instRows)) {
          for (const row of instRows as ApiInstrument[]) {
            if (row.symbol) instMap[row.symbol] = row;
          }
        }
      }
      setInstruments(instMap);

      const posMap: Record<string, ApiPosition[]> = {};
      const snapMap: Record<string, ApiPortfolioSnapshot> = {};

      await Promise.all(
        list.map(async (acc) => {
          if (!acc.id) return;
          const pr = await fetch(`${getApiUrl()}/api/accounts/${acc.id}/portfolio`, {
            headers,
          });
          if (!pr.ok) {
            posMap[acc.id] = [];
            return;
          }
          const snap = (await pr.json()) as ApiPortfolioSnapshot;
          snapMap[acc.id] = snap;
          posMap[acc.id] = (snap.holdings || []).map((h) => ({
            id: h.position_id,
            account_id: acc.id,
            symbol: h.symbol,
            quantity: h.quantity,
            instrument:
              h.current_price != null
                ? ({
                    symbol: h.symbol,
                    current_price: h.current_price,
                  } as ApiInstrument)
                : ({ symbol: h.symbol } as ApiInstrument),
          }));
        }),
      );
      setPortfolioByAccount(snapMap);
      setPositionsByAccount(posMap);

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

  const totalPositionsCount = useMemo(() => {
    let n = 0;
    for (const a of accounts) {
      const snap = portfolioByAccount[a.id];
      if (snap) n += snap.positions_count;
      else n += (positionsByAccount[a.id] || []).length;
    }
    return n;
  }, [accounts, portfolioByAccount, positionsByAccount]);

  const { totalValue, assetClassBreakdown } = useMemo(() => {
    const breakdown: Record<string, number> = {
      equity: 0,
      fixed_income: 0,
      alternatives: 0,
      cash: 0,
    };
    let total = 0;

    for (const account of accounts) {
      const snap = portfolioByAccount[account.id];
      if (snap) {
        total += snap.total_value;
        breakdown.cash += snap.cash_balance;
      } else {
        const cash = toNumber(account.cash_balance);
        total += cash;
        breakdown.cash += cash;
      }
    }

    for (const account of accounts) {
      const snap = portfolioByAccount[account.id];
      if (!snap) continue;
      for (const h of snap.holdings || []) {
        const positionValue = toNumber(h.value);
        if (positionValue <= 0) continue;
        const instrument = instruments[h.symbol];
        const alloc = instrument?.allocation_asset_class;
        if (alloc && typeof alloc === "object") {
          for (const [assetClass, pct] of Object.entries(alloc)) {
            const p = toNumber(pct);
            if (p <= 0) continue;
            const slice = (positionValue * p) / 100;
            breakdown[assetClass] = (breakdown[assetClass] || 0) + slice;
          }
        } else {
          breakdown.unclassified = toNumber(breakdown.unclassified) + positionValue;
        }
      }
    }

    const sumParts = Object.values(breakdown).reduce((s, v) => s + toNumber(v), 0);
    const gap = Math.max(0, total - sumParts);
    if (gap > 0.005) {
      breakdown.unclassified = toNumber(breakdown.unclassified) + gap;
    }

    return { totalValue: total, assetClassBreakdown: breakdown };
  }, [accounts, portfolioByAccount, instruments]);

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

  /** Refetch authoritative portfolio snapshot (marks, values, weights). */
  const refetchAccountPortfolio = useCallback(
    async (accountId: string) => {
      if (!enabled) return;
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const pr = await fetch(`${getApiUrl()}/api/accounts/${accountId}/portfolio`, {
        headers,
      });
      if (!pr.ok) return;
      const snap = (await pr.json()) as ApiPortfolioSnapshot;
      setPortfolioByAccount((m) => ({ ...m, [accountId]: snap }));
      const plist: ApiPosition[] = (snap.holdings || []).map((h) => ({
        id: h.position_id,
        account_id: accountId,
        symbol: h.symbol,
        quantity: h.quantity,
        instrument:
          h.current_price != null
            ? ({
                symbol: h.symbol,
                current_price: h.current_price,
              } as ApiInstrument)
            : ({ symbol: h.symbol } as ApiInstrument),
      }));
      setPositionsByAccount((m) => ({ ...m, [accountId]: plist }));
    },
    [enabled, getToken],
  );

  const reloadAccountPositions = refetchAccountPortfolio;

  const updatePositionQuantity = useCallback(
    async (accountId: string, positionId: string, quantity: number) => {
      if (!enabled) return;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      try {
        const res = await fetch(`${getApiUrl()}/api/positions/${positionId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quantity }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.detail === "string" ? err.detail : "Could not update quantity");
        }
        const data = (await res.json().catch(() => null)) as
          | ApiPosition
          | PositionMutationResponse
          | null;
        const accRow = isPositionMutationEnvelope(data) ? data.account : null;
        if (accRow?.id) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === accRow.id ? { ...a, ...accRow } : a)),
          );
        }
        await refetchAccountPortfolio(accountId);
      } catch (e) {
        await refetchAccountPortfolio(accountId);
        throw e;
      }
    },
    [enabled, getToken, refetchAccountPortfolio],
  );

  const deletePosition = useCallback(
    async (accountId: string, positionId: string) => {
      if (!enabled) return;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      try {
        const res = await fetch(`${getApiUrl()}/api/positions/${positionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.detail === "string" ? err.detail : "Could not delete position");
        }
        const raw = await res.json().catch(() => null);
        if (raw && typeof raw === "object" && "account" in raw) {
          const acc = (raw as { account?: ApiAccount }).account;
          if (acc?.id) {
            setAccounts((prev) =>
              prev.map((a) => (a.id === acc.id ? { ...a, ...acc } : a)),
            );
          }
        }
        await refetchAccountPortfolio(accountId);
      } catch (e) {
        await refetchAccountPortfolio(accountId);
        throw e;
      }
    },
    [enabled, getToken, refetchAccountPortfolio],
  );

  const createPosition = useCallback(
    async (input: CreatePositionInput) => {
      if (!enabled) return;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${getApiUrl()}/api/positions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: input.account_id,
          symbol: input.symbol.toUpperCase(),
          quantity: input.quantity,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Could not add position");
      }
      const raw = await res.json();
      if (isPositionMutationEnvelope(raw)) {
        if (raw.account?.id) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === raw.account.id ? { ...a, ...raw.account } : a)),
          );
        }
        if (raw.position?.instrument && raw.position.symbol) {
          setInstruments((prev) => ({
            ...prev,
            [raw.position.symbol]: raw.position.instrument as ApiInstrument,
          }));
        }
      }
      await refetchAccountPortfolio(input.account_id);
    },
    [enabled, getToken, refetchAccountPortfolio],
  );

  const createAccount = useCallback(
    async (input: CreateAccountInput) => {
      if (!enabled) return;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${getApiUrl()}/api/accounts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_name: input.account_name,
          account_purpose: input.account_purpose || "Investment Account",
          cash_balance: input.cash_balance,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Could not create account");
      }
      const created = (await res.json().catch(() => null)) as ApiAccount | null;
      if (created && typeof created.id === "string" && created.id) {
        setAccounts((prev) => [...prev, created]);
        setPositionsByAccount((m) => ({ ...m, [created.id]: [] }));
        setPortfolioByAccount((m) => ({
          ...m,
          [created.id]: {
            account_id: created.id,
            cash_balance: toNumber(created.cash_balance),
            total_positions_value: 0,
            total_value: toNumber(created.cash_balance),
            positions_count: 0,
            holdings: [],
          },
        }));
      } else {
        await load();
      }
    },
    [enabled, getToken, load],
  );

  return {
    user,
    accounts,
    portfolioByAccount,
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
    updatePositionQuantity,
    deletePosition,
    createPosition,
    createAccount,
    reloadAccountPositions,
    refetchAccountPortfolio,
  };
}
