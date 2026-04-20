import Link from "next/link";
import { useMemo } from "react";
import type {
  ApiAccount,
  ApiInstrument,
  ApiPortfolioSnapshot,
  ApiPosition,
} from "@/lib/useDashboardData";
import { FinancialCard } from "@/components/ui/FinancialCard";
import { formatUsdDetailed, toNumber } from "@/lib/format";

function accountTotalValue(
  acc: ApiAccount,
  positions: ApiPosition[],
  instruments: Record<string, ApiInstrument>
): number {
  let total = toNumber(acc.cash_balance);
  for (const p of positions) {
    const inst = instruments[p.symbol];
    const price = inst ? toNumber(inst.current_price) : 0;
    total += price * toNumber(p.quantity);
  }
  return total;
}

export type AccountsSummaryCardProps = {
  loading: boolean;
  accounts: ApiAccount[];
  portfolioByAccount?: Record<string, ApiPortfolioSnapshot>;
  positionsByAccount: Record<string, ApiPosition[]>;
  instruments: Record<string, ApiInstrument>;
};

/**
 * Dense accounts strip for dashboard core grid (not full ledger).
 */
export function AccountsSummaryCard({
  loading,
  accounts,
  portfolioByAccount,
  positionsByAccount,
  instruments,
}: AccountsSummaryCardProps) {
  const rows = useMemo(() => {
    return [...accounts]
      .map((a) => ({
        id: a.id,
        name: a.account_name || "Account",
        value:
          portfolioByAccount?.[a.id]?.total_value ??
          accountTotalValue(a, positionsByAccount[a.id] ?? [], instruments),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [accounts, portfolioByAccount, positionsByAccount, instruments]);

  if (loading) {
    return (
      <FinancialCard padding="md" elevation="flat" className="h-full min-h-[var(--dash-row-height)] min-w-0">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-[10px] bg-[var(--border)]" />
          ))}
        </div>
      </FinancialCard>
    );
  }

  if (accounts.length === 0) {
    return (
      <FinancialCard padding="md" elevation="flat" className="h-full min-h-[var(--dash-row-height)] min-w-0">
        <p className="ds-caption normal-case tracking-normal text-[var(--text-secondary)]">Accounts</p>
        <p className="ds-h3 mt-2">Connect data</p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--text-secondary)]">
          Add an account to populate book-level intelligence.
        </p>
        <Link
          href="/dashboard#holdings"
          className="mt-4 inline-flex rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--text-on-accent)] transition active:scale-[0.98] hover:opacity-95"
        >
          Add account
        </Link>
      </FinancialCard>
    );
  }

  return (
    <FinancialCard padding="md" elevation="flat" className="flex h-full min-h-[var(--dash-row-height)] min-w-0 flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="ds-caption normal-case tracking-normal text-[var(--text-secondary)]">Accounts</p>
          <p className="ds-h3 mt-1">Summary</p>
        </div>
        <Link
          href="/dashboard#holdings"
          className="shrink-0 rounded-[10px] border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-hover)]"
        >
          View all
        </Link>
      </div>
      <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/dashboard?account=${encodeURIComponent(r.id)}#holdings`}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-transparent px-2 py-2 transition hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text-primary)]">{r.name}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                {formatUsdDetailed(r.value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </FinancialCard>
  );
}
