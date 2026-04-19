import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import ConfirmModal from "../components/ConfirmModal";
import { getApiUrl } from "../lib/config";
import { SkeletonTable } from "../components/Skeleton";
import Head from "next/head";
import { pageTitle } from "@/lib/brand";
import { AppPageHero } from "@/components/shell/AppPageHero";
import { DsCard, DsMetricTile } from "@/components/ds";

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  current_price?: number;
}

interface Account {
  id: string;
  account_name: string;
  account_purpose: string;
  cash_balance: number;
  positions?: Position[];
}

export default function Accounts() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', purpose: '', cash_balance: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    accountId?: string;
    accountName?: string;
  }>({ isOpen: false });

  const loadAccounts = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const accountsWithPositions = await Promise.all(
          data.map(async (account: Account) => {
            if (!account.id) {
              return { ...account, positions: [] };
            }

            try {
              const positionsResponse = await fetch(
                `${getApiUrl()}/api/accounts/${account.id}/positions`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );
              if (positionsResponse.ok) {
                const posData = await positionsResponse.json();
                const positions = posData.positions || [];
                return { ...account, positions };
              }
            } catch {
              /* ignore per-account position load errors */
            }
            return { ...account, positions: [] };
          })
        );
        setAccounts(accountsWithPositions);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Listen for analysis completion events to refresh data
  useEffect(() => {
    const handleAnalysisCompleted = () => {
      loadAccounts();
    };

    // Listen for the completion event
    window.addEventListener('analysis:completed', handleAnalysisCompleted);

    return () => {
      window.removeEventListener('analysis:completed', handleAnalysisCompleted);
    };
  }, [loadAccounts]);

  const calculateAccountTotal = (account: Account) => {
    const positionsValue = account.positions?.reduce((sum, position) => {
      const value = Number(position.quantity) * (Number(position.current_price) || 0);
      return sum + value;
    }, 0) || 0;
    return Number(account.cash_balance) + positionsValue;
  };

  const calculatePortfolioTotal = () => {
    return accounts.reduce((sum, account) => sum + calculateAccountTotal(account), 0);
  };

  const handleAddAccount = async () => {
    if (!newAccount.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter an account name' });
      return;
    }

    setSavingAccount(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/api/accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_name: newAccount.name,
          account_purpose: newAccount.purpose || 'Investment Account',
          cash_balance: parseFloat(newAccount.cash_balance.replace(/,/g, '')) || 0,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account created successfully' });
        setShowAddModal(false);
        setNewAccount({ name: '', purpose: '', cash_balance: '' });
        await loadAccounts();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to create account' });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      setMessage({ type: 'error', text: 'Error creating account' });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setDeletingAccountId(accountId);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account deleted successfully' });
        await loadAccounts();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete account' });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: 'Error deleting account' });
    } finally {
      setDeletingAccountId(null);
    }
  };

  const formatCurrencyInput = (value: string) => {
    // Remove non-numeric characters except decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Format with commas
    const parts = cleaned.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const totalPositions = accounts.reduce((sum, acc) => sum + (acc.positions?.length || 0), 0);

  return (
    <>
      <Head>
        <title>{pageTitle("Accounts")}</title>
      </Head>
      <Layout>
        <div className="ds-page min-w-0 py-[var(--space-8)]">
          <AppPageHero
            title="Investment accounts"
            subtitle="Manage linked accounts, cash balances, and positions."
            kpi={
              !loading && accounts.length > 0 ? (
                <div className="ds-shell">
                  <div className="ds-grid-item ds-shell-span-4 min-w-0">
                    <DsMetricTile
                      label="Total portfolio value"
                      value={`$${calculatePortfolioTotal().toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    />
                  </div>
                  <div className="ds-grid-item ds-shell-span-4 min-w-0">
                    <DsMetricTile label="Accounts" value={accounts.length} />
                  </div>
                  <div className="ds-grid-item ds-shell-span-4 min-w-0">
                    <DsMetricTile label="Open positions" value={totalPositions} />
                  </div>
                </div>
              ) : null
            }
          />

          <div className="ds-shell">
            <DsCard padding="lg" className="ds-shell-span-12 ds-stack-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-[var(--space-4)]">
                <p className="ds-body min-w-0 text-[var(--text-secondary)]">
                  Add accounts to power portfolio analysis and reporting.
                </p>
                <button type="button" className="ds-btn-primary shrink-0" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  Add account
                </button>
              </div>

              {message ? (
                <div
                  className={`rounded-[var(--radius-card)] border p-[var(--space-4)] ${
                    message.type === "success"
                      ? "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--card))] text-[var(--success)]"
                      : "border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] text-[var(--danger)]"
                  }`}
                >
                  <p className="ds-body">{message.text}</p>
                </div>
              ) : null}

              {loading ? (
                <SkeletonTable rows={3} />
              ) : accounts.length === 0 ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-6)] text-center">
                  <p className="ds-h3 mb-[var(--space-2)]">No accounts yet</p>
                  <p className="ds-body text-[var(--text-secondary)]">
                    Use &quot;Add account&quot; to create one, then add positions from the dashboard or API.
                  </p>
                </div>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">Account Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)] hidden md:table-cell">Type</th>
                      <th className="text-right py-3 px-4 font-semibold text-[var(--text-secondary)]">Positions</th>
                      <th className="text-right py-3 px-4 font-semibold text-[var(--text-secondary)]">Cash</th>
                      <th className="text-right py-3 px-4 font-semibold text-[var(--text-secondary)]">Total Value</th>
                      <th className="text-center py-3 px-4 font-semibold text-[var(--text-secondary)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const positionsValue = calculateAccountTotal(account) - Number(account.cash_balance);
                      return (
                        <tr key={account.id} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">{account.account_name}</p>
                              <p className="text-xs text-[var(--text-secondary)] md:hidden">{account.account_purpose}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 hidden md:table-cell">
                            <span className="text-sm text-[var(--text-secondary)]">{account.account_purpose}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div>
                              <p className="font-medium">{account.positions?.length || 0}</p>
                              {positionsValue > 0 && (
                                <p className="text-xs text-[var(--text-secondary)]">
                                  ${positionsValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            ${Number(account.cash_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <p className="ds-body font-semibold text-[var(--accent)]">
                              ${calculateAccountTotal(account).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => router.push(`/accounts/${account.id}`)}
                                className="rounded-[var(--radius-control)] p-2 text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]"
                                title="View/Edit"
                              >
                                <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmModal({
                                  isOpen: true,
                                  accountId: account.id,
                                  accountName: account.account_name
                                })}
                                disabled={deletingAccountId === account.id}
                                className="rounded-[var(--radius-control)] p-2 text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </DsCard>
          </div>

        {/* Add Account Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-[var(--space-4)]">
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-[var(--space-6)] shadow-[var(--shadow-card)]">
              <h3 className="ds-h3 mb-[var(--space-4)]">Add new account</h3>

              <div className="ds-stack-3">
                <div className="min-w-0">
                  <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
                    Account name *
                  </label>
                  <input
                    type="text"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="box-border h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    placeholder="e.g., 401k, Roth IRA, Brokerage"
                  />
                </div>

                <div className="min-w-0">
                  <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
                    Account purpose
                  </label>
                  <input
                    type="text"
                    value={newAccount.purpose}
                    onChange={(e) => setNewAccount({ ...newAccount, purpose: e.target.value })}
                    className="box-border h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    placeholder="e.g., Long-term growth, retirement"
                  />
                </div>

                <div className="min-w-0">
                  <label className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]">
                    Initial cash balance
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">$</span>
                    <input
                      type="text"
                      value={newAccount.cash_balance}
                      onChange={(e) => setNewAccount({ ...newAccount, cash_balance: formatCurrencyInput(e.target.value) })}
                      className="box-border h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {message && message.type === 'error' && (
                <div className="mt-[var(--space-4)] rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card))] p-[var(--space-3)] text-sm text-[var(--danger)]">
                  {message.text}
                </div>
              )}

              <div className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
                <button
                  type="button"
                  onClick={handleAddAccount}
                  disabled={savingAccount}
                  className="ds-btn-primary min-h-0 flex-1 py-2"
                >
                  {savingAccount ? 'Creating…' : 'Create account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewAccount({ name: '', purpose: '', cash_balance: '' });
                    setMessage(null);
                  }}
                  className="ds-btn-secondary min-h-0 flex-1 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title="Delete Account"
          message={
              <div>
                <p>Are you sure you want to delete <span className="font-semibold">&ldquo;{confirmModal.accountName}&rdquo;</span>?</p>
                <p className="text-sm mt-2">This will also delete all positions in this account.</p>
                <p className="mt-2 text-sm font-semibold text-[var(--danger)]">
                  This action cannot be undone.
                </p>
              </div>
          }
          confirmText="Delete Account"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          onConfirm={() => {
            if (confirmModal.accountId) {
              handleDeleteAccount(confirmModal.accountId);
            }
            setConfirmModal({ isOpen: false });
          }}
          onCancel={() => setConfirmModal({ isOpen: false })}
          isProcessing={deletingAccountId !== null}
        />
        </div>
      </Layout>
    </>
  );
}