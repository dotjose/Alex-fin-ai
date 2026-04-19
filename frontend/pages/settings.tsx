import { useAuth, useUser } from "@clerk/nextjs";
import Head from "next/head";
import { pageTitle } from "@/lib/brand";
import { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getApiUrl } from "../lib/config";
import { Skeleton, SkeletonText } from "../components/Skeleton";
import { showToast } from "../components/Toast";

interface UserRow {
  display_name?: string;
  years_until_retirement?: number;
  target_retirement_income?: number | string;
  asset_class_targets?: { equity?: number; fixed_income?: number };
  region_targets?: { north_america?: number; international?: number };
}

function num(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SettingsPage() {
  const { isLoaded: userLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [yearsUntilRetirement, setYearsUntilRetirement] = useState(0);
  const [targetRetirementIncome, setTargetRetirementIncome] = useState(0);
  const [equityTarget, setEquityTarget] = useState(0);
  const [fixedIncomeTarget, setFixedIncomeTarget] = useState(0);
  const [northAmericaTarget, setNorthAmericaTarget] = useState(0);
  const [internationalTarget, setInternationalTarget] = useState(0);

  const load = useCallback(async () => {
    if (!userLoaded || !user) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${getApiUrl()}/api/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load settings");
      const body = await res.json();
      const u = body.user as UserRow;
      setDisplayName(u.display_name ?? "");
      setYearsUntilRetirement(num(u.years_until_retirement, 0));
      setTargetRetirementIncome(num(u.target_retirement_income, 0));
      setEquityTarget(num(u.asset_class_targets?.equity, 0));
      setFixedIncomeTarget(num(u.asset_class_targets?.fixed_income, 0));
      setNorthAmericaTarget(num(u.region_targets?.north_america, 0));
      setInternationalTarget(num(u.region_targets?.international, 0));
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [userLoaded, user, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      showToast("error", "Display name is required");
      return;
    }
    if (yearsUntilRetirement < 0 || yearsUntilRetirement > 50) {
      showToast("error", "Years until retirement must be between 0 and 50");
      return;
    }
    if (targetRetirementIncome < 0) {
      showToast("error", "Target retirement income must be positive");
      return;
    }
    if (Math.abs(equityTarget + fixedIncomeTarget - 100) > 0.01) {
      showToast("error", "Equity and fixed income must sum to 100%");
      return;
    }
    if (Math.abs(northAmericaTarget + internationalTarget - 100) > 0.01) {
      showToast("error", "North America and international must sum to 100%");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${getApiUrl()}/api/user`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          years_until_retirement: yearsUntilRetirement,
          target_retirement_income: targetRetirementIncome,
          asset_class_targets: {
            equity: equityTarget,
            fixed_income: fixedIncomeTarget,
          },
          region_targets: {
            north_america: northAmericaTarget,
            international: internationalTarget,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("success", "Settings saved");
      await load();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{pageTitle("Settings")}</title>
      </Head>
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            All fields reflect your profile from the API. Updates are saved with{" "}
            <code className="rounded bg-[var(--surface)] px-1 text-xs">PUT /api/user</code>
            .
          </p>

          <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow-card)]">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <SkeletonText lines={4} />
              </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)]">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)]">
                    Target retirement income (annual, USD)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      targetRetirementIncome
                        ? targetRetirementIncome.toLocaleString("en-US")
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const n = parseInt(raw, 10);
                      setTargetRetirementIncome(Number.isFinite(n) ? n : 0);
                    }}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)]">
                    Years until retirement: {yearsUntilRetirement}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={yearsUntilRetirement}
                    onChange={(e) =>
                      setYearsUntilRetirement(Number(e.target.value))
                    }
                    className="mt-3 w-full accent-primary"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Target asset class mix
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Equity {equityTarget}% · Fixed income {fixedIncomeTarget}%
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={equityTarget}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEquityTarget(v);
                      setFixedIncomeTarget(100 - v);
                    }}
                    className="mt-3 w-full accent-primary"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Target regional mix
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    North America {northAmericaTarget}% · International{" "}
                    {internationalTarget}%
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={northAmericaTarget}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setNorthAmericaTarget(v);
                      setInternationalTarget(100 - v);
                    }}
                    className="mt-3 w-full accent-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}
