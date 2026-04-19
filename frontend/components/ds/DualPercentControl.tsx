import type { CSSProperties } from "react";
import { DsRangeInput, DsTextInput } from "./Field";

export type DsDualPercentControlProps = {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
  onLeftPctChange: (next: number) => void;
  disabled?: boolean;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function DsDualPercentControl({
  id,
  leftLabel,
  rightLabel,
  leftPct,
  onLeftPctChange,
  disabled,
}: DsDualPercentControlProps) {
  const safeLeft = clampPct(leftPct);
  const rightPct = 100 - safeLeft;
  const trackStyle = { "--ds-pct": `${safeLeft}%` } as CSSProperties;

  return (
    <div className="ds-stack-1 min-w-0">
      <div className="ds-dual-pct-labels">
        <span className="ds-body min-w-0 break-words font-medium text-[var(--text-primary)]">
          {leftLabel}{" "}
          <span className="ds-tabular text-[var(--text-secondary)]">{safeLeft}%</span>
        </span>
        <span className="ds-body min-w-0 break-words text-right font-medium text-[var(--text-primary)]">
          {rightLabel}{" "}
          <span className="ds-tabular text-[var(--text-secondary)]">{rightPct}%</span>
        </span>
      </div>
      <div className="ds-dual-pct-track" style={trackStyle}>
        <div className="ds-dual-pct-fill" />
      </div>
      <DsRangeInput
        id={`${id}-slider`}
        min={0}
        max={100}
        value={safeLeft}
        disabled={disabled}
        onChange={(e) => onLeftPctChange(clampPct(Number(e.target.value)))}
        aria-valuetext={`${leftLabel} ${safeLeft} percent, ${rightLabel} ${rightPct} percent`}
      />
      <div className="grid min-w-0 grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={`${id}-a`}
            className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]"
          >
            {leftLabel} %
          </label>
          <DsTextInput
            id={`${id}-a`}
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            disabled={disabled}
            className="ds-input-compact"
            value={safeLeft}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              onLeftPctChange(clampPct(Number.isNaN(raw) ? 0 : raw));
            }}
          />
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${id}-b`}
            className="ds-caption mb-1 block normal-case tracking-normal text-[var(--text-secondary)]"
          >
            {rightLabel} %
          </label>
          <DsTextInput
            id={`${id}-b`}
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            disabled={disabled}
            className="ds-input-compact"
            value={rightPct}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              const r = Number.isNaN(raw) ? 0 : clampPct(raw);
              onLeftPctChange(100 - r);
            }}
          />
        </div>
      </div>
    </div>
  );
}
