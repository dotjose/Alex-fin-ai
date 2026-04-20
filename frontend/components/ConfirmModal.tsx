import type { ReactNode } from "react";
import { AppModal } from "@/components/ui/AppModal";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-[var(--danger)] hover:opacity-90",
  onConfirm,
  onCancel,
  isProcessing = false,
}: ConfirmModalProps) {
  return (
    <AppModal
      open={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      showHeaderClose={false}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="ds-btn-secondary min-h-[44px] px-4 py-2 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`min-h-[44px] rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isProcessing ? "Processing…" : confirmText}
          </button>
        </>
      }
    >
      <div className="text-sm text-[var(--text-secondary)]">{message}</div>
    </AppModal>
  );
}
