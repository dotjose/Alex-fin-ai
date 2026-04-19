import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import type { ApiAccount, ApiInstrument, ApiPosition } from "@/lib/useDashboardData";
import { FinancialCard } from "@/components/ui/FinancialCard";
import { formatDataFreshness } from "@/lib/dashboardFreshness";
import { formatUsdDetailed, toNumber } from "@/lib/format";

export interface AccountsProps {
  loading: boolean;
  accounts: ApiAccount[];
  positionsByAccount: Record<string, ApiPosition[]>;
  instruments: Record<string, ApiInstrument>;
  dataFreshAt: Date | null;
  onSync: () => void | Promise<void>;
  /** Extra classes on the root card (e.g. margin when nested in dashboard shell). */
  cardClassName?: string;
}

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

function instrumentLabel(p: ApiPosition): string {
  const name = p.instrument?.name?.trim();
  if (name) return name;
  const sym = p.symbol?.trim();
  if (sym) return sym;
  return "Unlabeled";
}

function AccountsSkeleton({ cardClassName }: { cardClassName: string }) {
  return (
    <FinancialCard padding="md" elevation="flat" className={cardClassName}>
      <div className="h-3 w-28 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-[var(--border)]" />
        ))}
      </div>
    </FinancialCard>
  );
}

export default function Accounts({
  loading,
  accounts,
  positionsByAccount,
  instruments,
  dataFreshAt,
  onSync,
  cardClassName = "mt-6",
}: AccountsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sorted = useMemo(
    () =>
      [...accounts].sort((a, b) =>
        (a.account_name || "").localeCompare(b.account_name || "")
      ),
    [accounts]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.resolve(onSync());
    } finally {
      setSyncing(false);
    }
  }, [onSync]);

  if (loading) {
    return <AccountsSkeleton cardClassName={cardClassName} />;
  }

  if (accounts.length === 0) {
    return (
      <FinancialCard padding="md" elevation="flat" className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Accounts
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">Connect your first account</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Required to populate book and AI inputs.</p>
          </div>
          <Link
            href="/accounts"
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-95"
          >
            Add account
          </Link>
        </div>
      </FinancialCard>
    );
  }

  const feedLabel = formatDataFreshness(dataFreshAt);

  return (
    <FinancialCard padding="md" elevation="flat" className={cardClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Accounts &amp; activity
          </p>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Feed <span className="tabular-nums text-[var(--text-primary)]">{feedLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSync()}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] disabled:opacity-50"
          >
            {syncing ? "Syncing" : "Sync"}
          </button>
          <Link
            href="/accounts"
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-95"
          >
            Add account
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Sync</th>
              <th className="px-3 py-2">Status</th>
              <th className="w-8 px-2 py-2" aria-label="Expand" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
            {sorted.map((acc) => {
              const id = acc.id;
              const positions = positionsByAccount[id] || [];
              const expanded = openId === id;
              const value = accountTotalValue(acc, positions, instruments);
              const status =
                positions.length > 0
                  ? "Linked"
                  : toNumber(acc.cash_balance) > 0
                    ? "Cash"
                    : "Idle";

              return (
                <Fragment key={id}>
                  <tr className="bg-[var(--card)] transition-colors hover:bg-[var(--surface)]">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{acc.account_name?.trim() || "Account"}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                      {formatUsdDetailed(value)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{feedLabel}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold">
                        {status}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(expanded ? null : id)}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        aria-expanded={expanded}
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-[var(--surface)]">
                      <td colSpan={5} className="px-3 py-2">
                        {positions.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            No positions ·{" "}
                            <Link href={`/accounts/${id}`} className="font-semibold text-[var(--accent)]">
                              Open account
                            </Link>
                          </p>
                        ) : (
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">
                                <th className="pb-1">Sym</th>
                                <th className="pb-1">Qty</th>
                                <th className="pb-1">Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {positions.map((p) => (
                                <tr key={p.id} className="border-t border-[var(--border)]">
                                  <td className="py-1.5 font-mono font-medium">{p.symbol}</td>
                                  <td className="py-1.5 tabular-nums">{String(p.quantity)}</td>
                                  <td className="py-1.5 text-[var(--text-secondary)]">{instrumentLabel(p)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </FinancialCard>
  );
}
