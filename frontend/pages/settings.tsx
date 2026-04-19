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

type SettingsSnapshot = {
  displayName: string;
  targetRetirementIncome: number;
  yearsUntilRetirement: number;
  equityTarget: number;
  northAmericaTarget: number;
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

function snapshotFromFields(
  displayName: string,
  targetRetirementIncome: number,
  yearsUntilRetirement: number,
  equityTarget: number,
  northAmericaTarget: number
): SettingsSnapshot {
  return {
    displayName: displayName.trim(),
    targetRetirementIncome,
    yearsUntilRetirement,
    equityTarget,
    northAmericaTarget,
  };
}

export default function SettingsPage() {
  const { isLoaded: userLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [yearsUntilRetirement, setYearsUntilRetirement] = useState(0);
  const [targetRetirementIncome, setTargetRetirementIncome] = useState(0);
  const [equityTarget, setEquityTarget] = useState(50);
  const [northAmericaTarget, setNorthAmericaTarget] = useState(50);
  const [baseline, setBaseline] = useState<SettingsSnapshot | null>(null);

  const fixedIncomeTarget = 100 - equityTarget;
  const internationalTarget = 100 - northAmericaTarget;

  const currentSnapshot = useMemo(
    () =>
      snapshotFromFields(
        displayName,
        targetRetirementIncome,
        yearsUntilRetirement,
        equityTarget,
        northAmericaTarget
      ),
    [displayName, targetRetirementIncome, yearsUntilRetirement, equityTarget, northAmericaTarget]
  );

  const isDirty = Boolean(
    baseline && JSON.stringify(currentSnapshot) !== JSON.stringify(baseline)
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
      const body = await res.json();
      if (body.user) {
        const u = body.user as UserRow;
        const dn = u.display_name ?? "";
        const yrs = num(u.years_until_retirement, 0);
        const tri = num(u.target_retirement_income, 0);
        const eq = coercePairToLeft(u.asset_class_targets?.equity, u.asset_class_targets?.fixed_income);
        const na = coercePairToLeft(u.region_targets?.north_america, u.region_targets?.international);
        setDisplayName(dn);
        setYearsUntilRetirement(yrs);
        setTargetRetirementIncome(tri);
        setEquityTarget(eq);
        setNorthAmericaTarget(na);
        setBaseline(snapshotFromFields(dn, tri, yrs, eq, na));
      } else if (body.user_id) {
        const dn =
          user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "";
        const yrs = 0;
        const tri = 0;
        const eq = 50;
        const na = 50;
        setDisplayName(dn);
        setYearsUntilRetirement(yrs);
        setTargetRetirementIncome(tri);
        setEquityTarget(eq);
        setNorthAmericaTarget(na);
        setBaseline(snapshotFromFields(dn, tri, yrs, eq, na));
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

  const handleSave = async () => {
    if (!displayName.trim()) {
      showToast("error", "Display name is required");
      return;
    }
    if (targetRetirementIncome < 0) {
      showToast("error", "Target retirement income must be positive");
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
      const saveBody = await res.json();
      if (saveBody.user) {
        const u = saveBody.user as UserRow;
        const dn = u.display_name ?? "";
        const yrs = num(u.years_until_retirement, 0);
        const tri = num(u.target_retirement_income, 0);
        const eq = coercePairToLeft(u.asset_class_targets?.equity, u.asset_class_targets?.fixed_income);
        const na = coercePairToLeft(u.region_targets?.north_america, u.region_targets?.international);
        setDisplayName(dn);
        setYearsUntilRetirement(yrs);
        setTargetRetirementIncome(tri);
        setEquityTarget(eq);
        setNorthAmericaTarget(na);
        setBaseline(snapshotFromFields(dn, tri, yrs, eq, na));
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

  const saveDisabled = saving || !displayName.trim() || !isDirty;

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
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
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
                      />
                    </DsField>
                    <div className="grid min-w-0 gap-[var(--space-2)] sm:grid-cols-[minmax(0,200px)_1fr] sm:items-start sm:gap-[var(--space-4)]">
                      <span className="ds-caption pt-2.5 text-left normal-case tracking-normal text-[var(--text-secondary)] sm:pt-0">
                        Years until retirement
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
                        <DsBadge variant="neutral">{yearsUntilRetirement} yrs</DsBadge>
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
                      hint="Single source of truth: moving equity updates fixed income automatically."
                    >
                      <DsDualPercentControl
                        id="equity_mix"
                        leftLabel="Equity"
                        rightLabel="Fixed income"
                        leftPct={equityTarget}
                        onLeftPctChange={setEquityTarget}
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
                      hint="Single source of truth: both controls stay in sync."
                    >
                      <DsDualPercentControl
                        id="region_mix"
                        leftLabel="North America"
                        rightLabel="International"
                        leftPct={northAmericaTarget}
                        onLeftPctChange={setNorthAmericaTarget}
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
