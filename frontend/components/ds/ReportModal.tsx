import { AppModal } from "@/components/ui/AppModal";
import { ReportStructuredView } from "./ReportStructuredView";

export type ReportModalProps = {
  open: boolean;
  title: string;
  markdown: string;
  onClose: () => void;
};

/**
 * AI report — structured first, markdown appendix (portal + AppModal).
 */
export function ReportModal({ open, title, markdown, onClose }: ReportModalProps) {
  return (
    <AppModal open={open} onClose={onClose} title={title} size="lg" showHeaderClose>
      {markdown.trim() ? (
        <ReportStructuredView markdown={markdown} />
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">No narrative stored for this job.</p>
      )}
    </AppModal>
  );
}
