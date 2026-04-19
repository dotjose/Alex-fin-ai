import type { ReactNode } from "react";

type LandingSectionProps = {
  children: ReactNode;
  /** Outer section classes (background, borders). */
  className?: string;
  /** Inner vertical padding (8px rhythm: 14×8, 16×8). */
  pad?: "md" | "lg";
  id?: string;
};

const padClass = { md: "py-14 sm:py-16", lg: "py-16 sm:py-24" };

export function LandingSection({
  children,
  className = "border-b border-[var(--border)] bg-[var(--bg)]",
  pad = "lg",
  id,
}: LandingSectionProps) {
  return (
    <section id={id} className={className}>
      <div className={`mx-auto max-w-[1200px] px-6 ${padClass[pad]}`}>
        {children}
      </div>
    </section>
  );
}
