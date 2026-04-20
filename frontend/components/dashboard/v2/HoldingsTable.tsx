"use client";

import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import type {
  ApiAccount,
  ApiInstrument,
  ApiPortfolioSnapshot,
  ApiPosition,
} from "@/lib/useDashboardData";
import { formatUsd, formatUsdDetailed, toNumber } from "@/lib/format";

export type HoldingsTableProps = {
  loading: boolean;
  accounts: ApiAccount[];
  portfolioByAccount: Record<string, ApiPortfolioSnapshot>;
  instruments: Record<string, ApiInstrument>;
  positionsByAccount: Record<string, ApiPosition[]>;
  onQuantityCommit: (accountId: string, position: ApiPosition, raw: string) => Promise<void>;
  onDelete: (accountId: string, positionId: string, symbol: string) => void;
};

export type HoldingRowModel = {
  key: string;
  accountId: string;
  accountName: string;
  positionId: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number | null;
  value: number;
  weightPct: number | null;
  pnl: number | null;
  priceStatus: string;
};

function buildRows(
  accounts: ApiAccount[],
  portfolioByAccount: Record<string, ApiPortfolioSnapshot>,
  instruments: Record<string, ApiInstrument>,
): HoldingRowModel[] {
  const grandTotal = accounts.reduce((s, a) => {
    const snap = portfolioByAccount[a.id];
    return s + (snap?.total_value ?? toNumber(a.cash_balance));
  }, 0);

  const rows: HoldingRowModel[] = [];
  for (const acc of accounts) {
    const snap = portfolioByAccount[acc.id];
    if (!snap) continue;
    const accName = acc.account_name?.trim() || "Account";
    for (const h of snap.holdings) {
      const name = instruments[h.symbol]?.name?.trim() || h.symbol;
      const price = h.current_price ?? null;
      const ref = h.average_price;
      const computedValue =
        price != null && Number.isFinite(price) && Number.isFinite(h.quantity)
          ? Math.round(price * h.quantity * 100) / 100
          : h.value;
      let pnl: number | null = null;
      if (price != null && ref != null && Number.isFinite(price) && Number.isFinite(ref)) {
        pnl = (price - ref) * h.quantity;
      }
      const weightPct =
        grandTotal > 0 && computedValue > 0
          ? Math.round((10000 * computedValue) / grandTotal) / 100
          : null;
      rows.push({
        key: `${acc.id}:${h.position_id}`,
        accountId: acc.id,
        accountName: accName,
        positionId: h.position_id,
        symbol: h.symbol,
        name,
        quantity: h.quantity,
        price,
        value: computedValue,
        weightPct,
        pnl,
        priceStatus: h.price_status,
      });
    }
  }
  return rows;
}

function QtyCell({
  position,
  onCommit,
}: {
  position: ApiPosition;
  onCommit: (raw: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onCommit(el.value);
  }, [onCommit]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        (e.target as HTMLInputElement).blur();
      }
    },
    [commit],
  );

  return (
    <input
      ref={ref}
      key={`${position.id}:${position.quantity}`}
      type="number"
      min={0}
      step="any"
      defaultValue={String(position.quantity)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className="w-full min-w-[72px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-gray-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-100 dark:focus:border-blue-400"
    />
  );
}

export const HoldingsTable = memo(function HoldingsTable({
  loading,
  accounts,
  portfolioByAccount,
  instruments,
  positionsByAccount,
  onQuantityCommit,
  onDelete,
}: HoldingsTableProps) {
  const rows = useMemo(
    () => buildRows(accounts, portfolioByAccount, instruments),
    [accounts, portfolioByAccount, instruments],
  );

  const resolvePosition = useCallback(
    (r: HoldingRowModel): ApiPosition => {
      const list = positionsByAccount[r.accountId] || [];
      return (
        list.find((p) => p.id === r.positionId) ?? {
          id: r.positionId,
          account_id: r.accountId,
          symbol: r.symbol,
          quantity: r.quantity,
          instrument: null,
        }
      );
    },
    [positionsByAccount],
  );

  const [pendingDel, setPendingDel] = useState<{ accountId: string; positionId: string; symbol: string } | null>(
    null,
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-neutral-800" />
        <div className="mt-6 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-50 dark:bg-neutral-800/80" />
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-10 text-center dark:border-neutral-700 dark:bg-neutral-900/60">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">No accounts yet</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Add an account to start tracking holdings and marks.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-10 text-center dark:border-neutral-700 dark:bg-neutral-900/60">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">No positions yet</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Add a position to start building your portfolio. Values and P&amp;L use live marks from the server.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Holdings</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Consolidated across accounts · marks from portfolio snapshot
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">% Alloc</th>
              <th className="px-4 py-3 text-right">P&amp;L</th>
              <th className="px-3 py-3 text-right" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {rows.map((r) => {
              const pos = resolvePosition(r);
              const pnlFmt =
                r.pnl != null && Number.isFinite(r.pnl) ? formatUsdDetailed(r.pnl) : "—";
              const pnlClass =
                r.pnl != null && r.pnl > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.pnl != null && r.pnl < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-gray-500 dark:text-gray-400";
              return (
                <tr
                  key={r.key}
                  className="bg-white transition-colors hover:bg-gray-50/80 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
                >
                  <td className="max-w-[140px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">
                    {r.accountName}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {r.symbol}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{r.name}</td>
                  <td className="px-4 py-3 text-right">
                    <QtyCell
                      position={pos}
                      onCommit={(raw) => void onQuantityCommit(r.accountId, pos, raw)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-200">
                    {r.price != null ? formatUsd(r.price) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">
                    {Number.isFinite(r.value) ? formatUsdDetailed(r.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                    {r.weightPct != null ? `${r.weightPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${pnlClass}`}>{pnlFmt}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPendingDel({ accountId: r.accountId, positionId: r.positionId, symbol: r.symbol })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      aria-label={`Remove ${r.symbol}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingDel ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Remove position</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Remove <strong className="text-gray-900 dark:text-gray-100">{pendingDel.symbol}</strong> from this
              account?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 dark:border-neutral-700 dark:text-gray-200"
                onClick={() => setPendingDel(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                onClick={() => {
                  const t = pendingDel;
                  setPendingDel(null);
                  if (t) onDelete(t.accountId, t.positionId, t.symbol);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
