import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { AppModal } from "@/components/ui/AppModal";
import { EmptyState, FinancialCard } from "@/components/ui/FinancialCard";
import { showToast } from "@/components/Toast";
import { getApiUrl } from "@/lib/config";
import type {
  ApiAccount,
  ApiInstrument,
  ApiPortfolioHolding,
  ApiPortfolioSnapshot,
  ApiPosition,
  CreateAccountInput,
  CreatePositionInput,
} from "@/lib/useDashboardData";
import { formatUsd, formatUsdDetailed, toNumber } from "@/lib/format";

export type PortfolioHoldingsLedgerProps = {
  loading: boolean;
  accounts: ApiAccount[];
  /** Server-computed portfolio (GET /api/accounts/{id}/portfolio). */
  portfolioByAccount: Record<string, ApiPortfolioSnapshot>;
  positionsByAccount: Record<string, ApiPosition[]>;
  instruments: Record<string, ApiInstrument>;
  updatePositionQuantity: (accountId: string, positionId: string, quantity: number) => Promise<void>;
  deletePosition: (accountId: string, positionId: string) => Promise<void>;
  createPosition: (input: CreatePositionInput) => Promise<void>;
  createAccount: (input: CreateAccountInput) => Promise<void>;
  /** Increment from parent to open add-account modal (e.g. portfolio overview). */
  signalOpenAddAccount?: number;
  /** Increment from parent to open add-position modal. */
  signalOpenAddPosition?: number;
};

function holdingAsPosition(accountId: string, h: ApiPortfolioHolding): ApiPosition {
  return {
    id: h.position_id,
    account_id: accountId,
    symbol: h.symbol,
    quantity: h.quantity,
    instrument: null,
  };
}

function formatCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function PortfolioHoldingsLedger({
  loading,
  accounts,
  portfolioByAccount,
  positionsByAccount,
  instruments,
  updatePositionQuantity,
  deletePosition,
  createPosition,
  createAccount,
  signalOpenAddAccount = 0,
  signalOpenAddPosition = 0,
}: PortfolioHoldingsLedgerProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [positionAccountId, setPositionAccountId] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({ name: "", purpose: "", cash_balance: "" });
  const [newPosition, setNewPosition] = useState({ symbol: "", quantity: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instrumentOptions, setInstrumentOptions] = useState<ApiInstrument[]>([]);
  const [confirmDel, setConfirmDel] = useState<{ accountId: string; positionId: string; symbol: string } | null>(
    null,
  );
  const closeAddAccount = useCallback(() => {
    setAddAccountOpen(false);
    setNewAccount({ name: "", purpose: "", cash_balance: "" });
  }, []);
  const closeAddPosition = useCallback(() => {
    setAddPositionOpen(false);
    setPositionAccountId(null);
    setNewPosition({ symbol: "", quantity: "" });
    setSearchTerm("");
    setSuggestOpen(false);
  }, []);

  useEffect(() => {
    const raw = router.query.account;
    const q = Array.isArray(raw) ? raw[0] : raw;
    if (typeof q === "string" && q) setOpenAccountId(q);
  }, [router.query.account]);

  useEffect(() => {
    if (!addPositionOpen) return;
    void (async () => {
      try {
        const t = await getToken();
        if (!t) return;
        const r = await fetch(`${getApiUrl()}/api/instruments`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (r.ok) {
          const j = (await r.json()) as unknown;
          setInstrumentOptions(Array.isArray(j) ? (j as ApiInstrument[]) : []);
        }
      } catch {
        setInstrumentOptions([]);
      }
    })();
  }, [addPositionOpen, getToken]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => (a.account_name || "").localeCompare(b.account_name || "")),
    [accounts],
  );

  const lastAccSig = useRef(0);
  const lastPosSig = useRef(0);
  useEffect(() => {
    if (loading) return;
    if (signalOpenAddAccount > lastAccSig.current) {
      lastAccSig.current = signalOpenAddAccount;
      setAddAccountOpen(true);
    }
  }, [signalOpenAddAccount, loading]);

  useEffect(() => {
    if (loading) return;
    if (signalOpenAddPosition > lastPosSig.current) {
      lastPosSig.current = signalOpenAddPosition;
      const first = sortedAccounts[0]?.id;
      if (first) {
        setPositionAccountId(first);
        setAddPositionOpen(true);
      } else {
        showToast("error", "Create an account first");
      }
    }
  }, [signalOpenAddPosition, sortedAccounts, loading]);

  const filteredInstruments = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return instrumentOptions
      .filter((i) => i.symbol.toLowerCase().includes(q) || (i.name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [instrumentOptions, searchTerm]);

  const openAddPosition = useCallback((accountId: string) => {
    if (!accountId) {
      showToast("error", "Create an account first");
      return;
    }
    setPositionAccountId(accountId);
    setAddPositionOpen(true);
  }, []);

  const handleCreateAccount = useCallback(async () => {
    if (!newAccount.name.trim()) {
      showToast("error", "Enter an account name");
      return;
    }
    setSaving(true);
    try {
      await createAccount({
        account_name: newAccount.name.trim(),
        account_purpose: newAccount.purpose.trim() || "Investment Account",
        cash_balance: parseFloat(newAccount.cash_balance.replace(/,/g, "")) || 0,
      });
      showToast("success", "Account created");
      closeAddAccount();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  }, [createAccount, newAccount, closeAddAccount]);

  const handleCreatePosition = useCallback(async () => {
    if (!positionAccountId) return;
    const sym = newPosition.symbol.trim().toUpperCase();
    const qty = parseFloat(newPosition.quantity);
    if (!sym || !Number.isFinite(qty) || qty <= 0) {
      showToast("error", "Enter symbol and a valid quantity");
      return;
    }
    setSaving(true);
    try {
      await createPosition({ account_id: positionAccountId, symbol: sym, quantity: qty });
      showToast("success", "Position added");
      closeAddPosition();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Could not add position");
    } finally {
      setSaving(false);
    }
  }, [createPosition, newPosition, positionAccountId, closeAddPosition]);

  const onQtyBlur = useCallback(
    async (accountId: string, p: ApiPosition, raw: string) => {
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) return;
      if (Math.abs(n - toNumber(p.quantity)) < 1e-9) return;
      try {
        await updatePositionQuantity(accountId, p.id, n);
      } catch {
        showToast("error", "Could not update quantity");
      }
    },
    [updatePositionQuantity],
  );

  if (loading) {
    return (
      <FinancialCard padding="lg" elevation="flat" id="holdings" className="min-w-0">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[var(--radius-card)] bg-[var(--surface)]" />
          ))}
        </div>
      </FinancialCard>
    );
  }

  const mainCard =
    accounts.length === 0 ? (
      <FinancialCard padding="lg" elevation="flat" id="holdings" className="min-w-0">
        <EmptyState
          title="No accounts yet"
          description="Track performance, risk, and AI insights once accounts and positions are on the book."
          actionLabel="Add your first account"
          actionHref="#portfolio-intelligence-actions"
        />
        <button
          type="button"
          onClick={() => setAddAccountOpen(true)}
          className="ds-btn-primary mt-6 min-h-[44px] px-5"
        >
          Add account
        </button>
      </FinancialCard>
    ) : null;

  if (accounts.length === 0) {
    return (
      <>
        {mainCard}
        <AppModal
          open={addAccountOpen}
          onClose={closeAddAccount}
          title="New account"
          size="md"
          footer={
            <>
              <button type="button" className="ds-btn-secondary px-4 py-2" onClick={closeAddAccount}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="ds-btn-primary px-4 py-2 disabled:opacity-50"
                onClick={() => void handleCreateAccount()}
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </>
          }
        >
          <AccountFormBody
            newAccount={newAccount}
            setNewAccount={setNewAccount}
            formatCurrencyInput={formatCurrencyInput}
          />
        </AppModal>
      </>
    );
  }

  return (
    <>
      <FinancialCard
        padding="lg"
        elevation="flat"
        id="holdings"
        className="min-w-0 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="ds-caption">Holdings</p>
            <h2 className="ds-h2 mt-1">Portfolio ledger</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Values and weights from your live portfolio snapshot (server + market data).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ds-btn-secondary px-4 py-2 text-sm" onClick={() => setAddAccountOpen(true)}>
              Add account
            </button>
            <button
              type="button"
              className="ds-btn-primary px-4 py-2 text-sm"
              onClick={() => openAddPosition(sortedAccounts[0]?.id ?? accounts[0]?.id ?? "")}
            >
              Add position
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {sortedAccounts.map((acc) => {
            const id = acc.id;
            const snap = portfolioByAccount[id];
            const positions = positionsByAccount[id] || [];
            const expanded = openAccountId === id;
            const bookDisplay =
              snap != null ? formatUsdDetailed(snap.total_value) : formatUsdDetailed(toNumber(acc.cash_balance));
            return (
              <div
                key={id}
                className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--accent)_22%,var(--border))]"
              >
                <button
                  type="button"
                  onClick={() => setOpenAccountId(expanded ? null : id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    )}
                    <span className="min-w-0 truncate font-semibold text-[var(--text-primary)]">
                      {acc.account_name?.trim() || "Account"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {bookDisplay}
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--border)] bg-[var(--card)] px-2 py-2 sm:px-4">
                    {snap == null ? (
                      <p className="px-2 py-4 text-center text-sm text-[var(--text-secondary)]">
                        Loading portfolio snapshot…
                      </p>
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap gap-4 border-b border-[var(--border)] px-2 pb-3 text-xs text-[var(--text-secondary)]">
                          <div>
                            <p className="font-semibold uppercase tracking-wide text-[10px]">Cash</p>
                            <p className="mt-0.5 tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                              {formatUsdDetailed(snap.cash_balance)}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-wide text-[10px]">Total value</p>
                            <p className="mt-0.5 tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                              {formatUsdDetailed(snap.total_value)}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-wide text-[10px]">Positions</p>
                            <p className="mt-0.5 tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                              {snap.positions_count}
                            </p>
                          </div>
                        </div>
                        {snap.holdings.length === 0 ? (
                          <div className="px-2 py-6 text-center">
                            <p className="text-sm font-medium text-[var(--text-primary)]">No positions yet</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              Add a position to start building your portfolio.
                            </p>
                            <button
                              type="button"
                              className="ds-btn-primary mt-4 px-4 py-2 text-sm"
                              onClick={() => openAddPosition(id)}
                            >
                              Add position
                            </button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <div
                              className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_88px_104px_112px_72px_44px] gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
                              role="row"
                            >
                              <span>Symbol</span>
                              <span className="text-right">Qty</span>
                              <span className="text-right">Price</span>
                              <span className="text-right">Value</span>
                              <span className="text-right">Weight</span>
                              <span className="sr-only">Actions</span>
                            </div>
                            {snap.holdings.map((h) => {
                              const p =
                                positions.find((x) => x.id === h.position_id) ??
                                holdingAsPosition(id, h);
                              const name = instruments[h.symbol]?.name?.trim();
                              const priceLabel =
                                h.current_price != null ? formatUsd(h.current_price) : "—";
                              const valueLabel = h.value > 0 ? formatUsd(h.value) : "—";
                              const weightLabel =
                                h.weight != null && snap.total_value > 0 ? `${h.weight}%` : "—";
                              return (
                                <div
                                  key={h.position_id}
                                  role="row"
                                  className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_88px_104px_112px_72px_44px] items-center gap-2 rounded-[var(--radius-control)] px-2 py-2 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_70%,var(--card))]"
                                >
                                  <div className="min-w-0 font-medium tabular-nums text-[var(--text-primary)]">
                                    <span className="tracking-tight">{h.symbol}</span>
                                    {h.price_status !== "ok" ? (
                                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--warning)]">
                                        {h.price_status === "not_configured"
                                          ? "Live price unavailable (configure Polygon)"
                                          : "Price unavailable"}
                                      </p>
                                    ) : null}
                                    {name ? (
                                      <p className="truncate text-xs font-normal text-[var(--text-secondary)]">
                                        {name}
                                      </p>
                                    ) : null}
                                  </div>
                                  <QtyInput
                                    position={p}
                                    onCommit={(raw) => void onQtyBlur(id, p, raw)}
                                  />
                                  <span className="text-right tabular-nums text-[var(--text-secondary)]">
                                    {priceLabel}
                                  </span>
                                  <span className="text-right font-medium tabular-nums text-[var(--text-primary)]">
                                    {valueLabel}
                                  </span>
                                  <span className="text-right tabular-nums text-[var(--text-secondary)]">
                                    {weightLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDel({
                                        accountId: id,
                                        positionId: h.position_id,
                                        symbol: h.symbol,
                                      })
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))]"
                                    aria-label={`Delete ${h.symbol}`}
                                  >
                                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </FinancialCard>

      <AppModal
        open={addAccountOpen}
        onClose={closeAddAccount}
        title="New account"
        size="md"
        footer={
          <>
            <button type="button" className="ds-btn-secondary px-4 py-2" onClick={closeAddAccount}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="ds-btn-primary px-4 py-2 disabled:opacity-50"
              onClick={() => void handleCreateAccount()}
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </>
        }
      >
        <AccountFormBody
          newAccount={newAccount}
          setNewAccount={setNewAccount}
          formatCurrencyInput={formatCurrencyInput}
        />
      </AppModal>

      <AppModal
        open={addPositionOpen}
        onClose={closeAddPosition}
        title="Add position"
        size="md"
        footer={
          <>
            <button type="button" className="ds-btn-secondary px-4 py-2" onClick={closeAddPosition}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="ds-btn-primary px-4 py-2 disabled:opacity-50"
              onClick={() => void handleCreatePosition()}
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </>
        }
      >
        <div className="ds-stack-3">
          <div>
            <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
              Symbol
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm || newPosition.symbol}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setSearchTerm(v);
                  setNewPosition({ ...newPosition, symbol: v });
                  setSuggestOpen(v.length > 0);
                }}
                onFocus={() => setSuggestOpen(searchTerm.length > 0)}
                className="box-border h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
                placeholder="Ticker (e.g. SPY)"
              />
              {suggestOpen && filteredInstruments.length > 0 ? (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
                  {filteredInstruments.map((inst) => (
                    <button
                      key={inst.symbol}
                      type="button"
                      className="w-full border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--surface)]"
                      onClick={() => {
                        setNewPosition({ ...newPosition, symbol: inst.symbol });
                        setSearchTerm("");
                        setSuggestOpen(false);
                      }}
                    >
                      <div className="font-medium tabular-nums">{inst.symbol}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{inst.name}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
              Quantity
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={newPosition.quantity}
              onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
              className="box-border h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
              placeholder="0"
            />
          </div>
        </div>
      </AppModal>

      <ConfirmModal
        isOpen={Boolean(confirmDel)}
        title="Remove position"
        message={
          confirmDel ? (
            <span>
              Remove <strong>{confirmDel.symbol}</strong> from this account?
            </span>
          ) : null
        }
        confirmText="Remove"
        cancelText="Cancel"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          if (!confirmDel) return;
          const { accountId, positionId } = confirmDel;
          setConfirmDel(null);
          void deletePosition(accountId, positionId).catch(() =>
            showToast("error", "Could not remove position"),
          );
        }}
      />
    </>
  );
}

function AccountFormBody({
  newAccount,
  setNewAccount,
  formatCurrencyInput,
}: {
  newAccount: { name: string; purpose: string; cash_balance: string };
  setNewAccount: Dispatch<SetStateAction<{ name: string; purpose: string; cash_balance: string }>>;
  formatCurrencyInput: (v: string) => string;
}) {
  return (
    <div className="ds-stack-3">
      <div>
        <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
          Account name
        </label>
        <input
          type="text"
          value={newAccount.name}
          onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
          className="box-border h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
          placeholder="e.g. Brokerage, IRA"
        />
      </div>
      <div>
        <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
          Purpose
        </label>
        <input
          type="text"
          value={newAccount.purpose}
          onChange={(e) => setNewAccount({ ...newAccount, purpose: e.target.value })}
          className="box-border h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
          placeholder="Long-term growth"
        />
      </div>
      <div>
        <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
          Initial cash
        </label>
        <input
          type="text"
          value={newAccount.cash_balance}
          onChange={(e) =>
            setNewAccount({ ...newAccount, cash_balance: formatCurrencyInput(e.target.value) })
          }
          className="box-border h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
          placeholder="0"
        />
      </div>
    </div>
  );
}

function QtyInput({ position, onCommit }: { position: ApiPosition; onCommit: (raw: string) => void }) {
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
      className="box-border h-9 w-full rounded-[var(--radius-control)] border border-transparent bg-[var(--bg)] px-2 text-right text-sm tabular-nums text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border)] focus:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))]"
    />
  );
}
