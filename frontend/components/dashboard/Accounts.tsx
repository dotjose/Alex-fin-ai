import Link from "next/link";
import { useMemo, useState } from "react";
import type { ApiAccount, ApiPosition } from "@/lib/useDashboardData";
import { FinancialCard, EmptyState } from "@/components/ui/FinancialCard";
import { formatUsdDetailed, toNumber } from "@/lib/format";

export interface AccountsProps {
  loading: boolean;
  accounts: ApiAccount[];
  positionsByAccount: Record<string, ApiPosition[]>;
}

function AccountsSkeleton() {
  return (
    <FinancialCard>
      <div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-[var(--border)]"
          />
        ))}
      </div>
    </FinancialCard>
  );
}

export default function Accounts({
  loading,
  accounts,
  positionsByAccount,
}: AccountsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...accounts].sort((a, b) =>
        (a.account_name || "").localeCompare(b.account_name || "")
      ),
    [accounts]
  );

  if (loading) {
    return <AccountsSkeleton />;
  }

  if (accounts.length === 0) {
    return (
      <FinancialCard>
        <EmptyState
          title="No accounts"
          description="Create an account in Accounts to pull balances and positions from the API into this list."
          actionLabel="Connect account / Add portfolio"
          actionHref="/accounts"
        />
      </FinancialCard>
    );
  }

  return (
    <FinancialCard>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Accounts</h3>
        <Link
          href="/accounts"
          className="text-sm font-medium text-[var(--accent)] transition hover:opacity-90"
        >
          Manage accounts
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-[var(--border)]">
        {sorted.map((acc) => {
          const id = acc.id;
          const positions = positionsByAccount[id] || [];
          const expanded = openId === id;
          const balance = toNumber(acc.cash_balance);

          return (
            <li key={id} className="py-4 first:pt-0">
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : id)}
                className="flex w-full items-start justify-between gap-4 text-left transition-opacity duration-200 hover:opacity-95"
              >
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {acc.account_name || "Account"}
                  </p>
                  {acc.account_purpose ? (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {acc.account_purpose}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatUsdDetailed(balance)}
                  </p>
                  <span className="text-[var(--text-secondary)]" aria-hidden>
                    {expanded ? "▾" : "▸"}
                  </span>
                </div>
              </button>
              {expanded && (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  {positions.length === 0 ? (
                    <EmptyState
                      title="No positions in this account"
                      description="Add positions for this account to see symbols and quantities from the API."
                      actionLabel="Add positions"
                      actionHref={`/accounts/${id}`}
                    />
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                          <th className="pb-2">Symbol</th>
                          <th className="pb-2">Qty</th>
                          <th className="pb-2">Instrument</th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--text-primary)]">
                        {positions.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="py-2 font-medium">{p.symbol}</td>
                            <td className="py-2 tabular-nums">
                              {String(p.quantity)}
                            </td>
                            <td className="py-2 text-[var(--text-secondary)]">
                              {p.instrument?.name ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </FinancialCard>
  );
}
