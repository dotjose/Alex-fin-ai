import type { InputHTMLAttributes, ReactNode } from "react";

export type DsFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  /** `row`: label left, control right (≥sm). Default stacked label above. */
  layout?: "stack" | "row";
};

export function DsField({ id, label, hint, error, children, layout = "stack" }: DsFieldProps) {
  if (layout === "row") {
    return (
      <div className="min-w-0">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-center sm:gap-4">
          <label
            htmlFor={id}
            className="ds-caption pt-2.5 text-left normal-case tracking-normal text-[var(--text-secondary)] sm:pt-0"
          >
            {label}
          </label>
          <div className="min-w-0">
            {children}
            {hint && !error ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{hint}</p> : null}
            {error ? <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="ds-caption block normal-case tracking-normal text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="mt-2 min-w-0">{children}</div>
      {hint && !error ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

const inputClass =
  "box-border h-11 w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] outline-none transition active:scale-[0.99] placeholder:text-[var(--text-secondary)] focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

export function DsTextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`.trim()} />;
}

export function DsRangeInput({ step = 1, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="range"
      step={step}
      className={`h-11 w-full min-w-0 cursor-pointer accent-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
}
