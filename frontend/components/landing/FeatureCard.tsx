import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  children: ReactNode;
};

export function FeatureCard({ title, children }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[var(--border)] hover:shadow-[var(--shadow-card)]">
      <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</p>
    </div>
  );
}
