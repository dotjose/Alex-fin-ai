import { useAuth, useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getApiUrl } from "../lib/config";
import { Skeleton, SkeletonText } from "../components/Skeleton";
import { showToast } from "../components/Toast";
import {
  DsBadge,
  DsCard,
  DsDualPercentControl,
  DsField,
  DsTextInput,
} from "@/components/ds";
import { AppPageHero } from "@/components/shell/AppPageHero";
import { pageTitle } from "@/lib/brand";

interface UserRow {
  display_name?: string;
  years_until_retirement?: number;
  target_retirement_income?: number | string;
  asset_class_targets?: { equity?: number; fixed_income?: number };
  region_targets?: { north_america?: number; international?: number };
}

/** Single source of truth for the settings form (payload mirrors this object). */
type SettingsForm = {
  displayName: string;
  yearsUntilRetirement: number;
  targetRetirementIncome: number;
  equity: number;
  fixedIncome: number;
  northAmerica: number;
  international: number;
};

function num(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Returns a 0–100 “left” value; pair sums to 100 with `100 - left`. */
function coercePairToLeft(a: unknown, b: unknown): number {
  let x = typeof a === "string" ? parseFloat(a) : Number(a);
  let y = typeof b === "string" ? parseFloat(b) : Number(b);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  if (x <= 1 && y <= 1 && x + y > 0.001 && x + y <= 2.001) {
    x *= 100;
    y *= 100;
  }
  const sum = x + y;
  if (sum <= 0.01) return 50;
  const left = Math.round((x / sum) * 100);
  return Math.max(0, Math.min(100, left));
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function defaultForm(displayNameFallback: string): SettingsForm {
  return {
    displayName: displayNameFallback,
    yearsUntilRetirement: 0,
    targetRetirementIncome: 0,
    equity: 50,
    fixedIncome: 50,
    northAmerica: 50,
    international: 50,
  };
}

function rowToForm(u: UserRow, displayNameFallback: string): SettingsForm {
  const eq = coercePairToLeft(u.asset_class_targets?.equity, u.asset_class_targets?.fixed_income);
  const na = coercePairToLeft(u.region_targets?.north_america, u.region_targets?.international);
  return {
    displayName: (u.display_name ?? displayNameFallback).trim() || displayNameFallback,
    yearsUntilRetirement: num(u.years_until_retirement, 0),
    targetRetirementIncome: num(u.target_retirement_income, 0),
    equity: eq,
    fixedIncome: 100 - eq,
    northAmerica: na,
    international: 100 - na,
  };
}

function formToApiPayload(f: SettingsForm) {
  const eq = clampPct(f.equity);
  const na = clampPct(f.northAmerica);
  return {
    display_name: f.displayName.trim(),
    years_until_retirement: f.yearsUntilRetirement,
    target_retirement_income: f.targetRetirementIncome,
    asset_class_targets: {
      equity: eq,
      fixed_income: 100 - eq,
    },
    region_targets: {
      north_america: na,
      international: 100 - na,
    },
  };
}

export default function SettingsPage() {
  const { isLoaded: userLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [form, setForm] = useState<SettingsForm>(() =>
    defaultForm("")
  );
  const [baseline, setBaseline] = useState<SettingsForm | null>(null);

  const isDirty = Boolean(
    baseline && JSON.stringify(form) !== JSON.stringify(baseline)
  );

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
      const body = (await res.json()) as {
        user_id?: string;
        user?: UserRow | null;
      };
      const fallbackName =
        user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "";
      if (body.user) {
        const next = rowToForm(body.user, fallbackName);
        setForm(next);
        setBaseline(next);
      } else if (body.user_id) {
        const next = defaultForm(fallbackName);
        setForm(next);
        setBaseline(next);
      } else {
        throw new Error("Unexpected user response");
      }
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [userLoaded, user, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const setEquityPair = (value: number) => {
    const v = clampPct(value);
    setForm((prev) => ({ ...prev, equity: v, fixedIncome: 100 - v }));
  };

  const setRegionPair = (value: number) => {
    const v = clampPct(value);
    setForm((prev) => ({ ...prev, northAmerica: v, international: 100 - v }));
  };

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      showToast("error", "Display name is required");
      return;
    }
    if (form.targetRetirementIncome < 0) {
      showToast("error", "Target retirement income must be positive");
      return;
    }

    const payload = formToApiPayload(form);

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
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { detail?: string };
        const detail =
          typeof errBody.detail === "string" ? errBody.detail : `Save failed (${res.status})`;
        throw new Error(detail);
      }
      const saveBody = (await res.json()) as { user?: UserRow };
      if (saveBody.user) {
        const fallbackName =
          user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "";
        const next = rowToForm(saveBody.user, fallbackName);
        setForm(next);
        setBaseline(next);
      }
      showToast("success", "Settings saved");
      setSaveFlash(true);
      window.setTimeout(() => setSaveFlash(false), 800);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || !form.displayName.trim() || !isDirty;

  const retirementInputValue = useMemo(
    () =>
      form.targetRetirementIncome ? form.targetRetirementIncome.toLocaleString("en-US") : "",
    [form.targetRetirementIncome]
  );

  return (
    <>
      <Head>
        <title>{pageTitle("Settings")}</title>
      </Head>
      <Layout>
        <div className="ds-page min-w-0 py-[var(--space-8)]">
          <AppPageHero
            title="Settings"
            subtitle="Profile and portfolio assumptions used by analysis jobs. Changes apply after you save."
          />

          <div className="ds-shell">
            <DsCard padding="lg" className="ds-shell-span-12 ds-stack-4">
              {loading ? (
                <div className="ds-stack-3">
                  <Skeleton className="h-11 w-full" />
                  <SkeletonText lines={4} />
                </div>
              ) : (
                <>
                  <section className="ds-stack-3 min-w-0">
                    <h2 className="ds-h2">Profile</h2>
                    <DsField id="display_name" label="Display name" layout="row" hint="Shown in the app shell.">
                      <DsTextInput
                        id="display_name"
                        type="text"
                        value={form.displayName}
                        onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                        autoComplete="name"
                      />
                    </DsField>
                  </section>

                  <hr className="ds-section-divider" />

                  <section className="ds-stack-3 min-w-0">
                    <h2 className="ds-h2">Retirement assumptions</h2>
                    <DsField
                      id="target_retirement_income"
                      label="Target retirement income (annual, USD)"
                      layout="row"
                      hint="Whole dollars; used in retirement projections."
                    >
                      <DsTextInput
                        id="target_retirement_income"
                        type="text"
                        inputMode="numeric"
                        value={retirementInputValue}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, "");
                          const n = parseInt(raw, 10);
                          setForm((p) => ({
                            ...p,
                            targetRetirementIncome: Number.isFinite(n) ? n : 0,
                          }));
                        }}
                      />
                    </DsField>
                    <div className="grid min-w-0 gap-[var(--space-2)] sm:grid-cols-[minmax(0,200px)_1fr] sm:items-start sm:gap-[var(--space-4)]">
                      <span className="ds-caption pt-2.5 text-left normal-case tracking-normal text-[var(--text-secondary)] sm:pt-0">
                        Years until retirement
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
                        <DsBadge variant="neutral">{form.yearsUntilRetirement} yrs</DsBadge>
                        <span className="ds-body text-[var(--text-secondary)]">
                          Read-only from your profile.
                        </span>
                      </div>
                    </div>
                  </section>

                  <hr className="ds-section-divider" />

                  <section className="ds-stack-3 min-w-0">
                    <h2 className="ds-h2">Allocation</h2>
                    <p className="ds-body text-[var(--text-secondary)]">
                      Equity and fixed income always total 100%. Adjust the slider or enter percentages
                      directly.
                    </p>
                    <DsField
                      id="equity_mix"
                      label="Equity vs fixed income"
                      layout="row"
                      hint="Both values are saved on the server."
                    >
                      <DsDualPercentControl
                        id="equity_mix"
                        leftLabel="Equity"
                        rightLabel="Fixed income"
                        leftPct={form.equity}
                        onLeftPctChange={setEquityPair}
                      />
                    </DsField>
                  </section>

                  <hr className="ds-section-divider" />

                  <section className="ds-stack-3 min-w-0">
                    <h2 className="ds-h2">Region mix</h2>
                    <p className="ds-body text-[var(--text-secondary)]">
                      North America and international always total 100%.
                    </p>
                    <DsField
                      id="region_mix"
                      label="North America vs international"
                      layout="row"
                      hint="Both values are saved on the server."
                    >
                      <DsDualPercentControl
                        id="region_mix"
                        leftLabel="North America"
                        rightLabel="International"
                        leftPct={form.northAmerica}
                        onLeftPctChange={setRegionPair}
                      />
                    </DsField>
                  </section>

                  <hr className="ds-section-divider" />

                  <section className="ds-stack-3 min-w-0">
                    <h2 className="ds-h2">Save</h2>
                    <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-3)]">
                      <button
                        type="button"
                        className="ds-btn-primary"
                        onClick={() => void handleSave()}
                        disabled={saveDisabled}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      {isDirty ? (
                        <DsBadge variant="neutral">Unsaved changes</DsBadge>
                      ) : (
                        <span className="ds-body text-[var(--text-secondary)]">All changes saved</span>
                      )}
                      {saving ? (
                        <span className="ds-body text-[var(--text-secondary)]">Writing…</span>
                      ) : saveFlash ? (
                        <span className="ds-save-pop ds-body font-semibold text-[var(--success)]">Saved</span>
                      ) : null}
                    </div>
                  </section>
                </>
              )}
            </DsCard>
          </div>
        </div>
      </Layout>
    </>
  );
}
