import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

export type ReportModalProps = {
  open: boolean;
  title: string;
  markdown: string;
  onClose: () => void;
};

/**
 * Full markdown report — scroll contained inside dialog (never page overflow).
 */
export function ReportModal({ open, title, markdown, onClose }: ReportModalProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex min-w-0 items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--overlay)]"
        aria-label="Close report"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-[720px] min-w-0 flex-col overflow-hidden rounded-t-[12px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card-hover)] sm:rounded-[12px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <h2 id="report-modal-title" className="ds-h2 min-w-0 break-words pr-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[10px] border border-transparent px-2 py-1 text-sm text-[var(--text-secondary)] transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {markdown.trim() ? (
            <div className="ds-prose-safe max-w-none space-y-3 text-sm leading-relaxed text-[var(--text-primary)] [&_a]:break-words [&_a]:text-[var(--accent)] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:break-words [&_h2]:text-base [&_h2]:font-semibold [&_li]:text-[var(--text-secondary)] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:break-words [&_p]:text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">No narrative stored for this job.</p>
          )}
        </div>
      </div>
    </div>
  );
}
