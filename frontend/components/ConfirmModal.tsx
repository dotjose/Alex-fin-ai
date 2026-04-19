import { ReactNode } from "react";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card-hover)]">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">{title}</h3>
        </div>

        <div className="mb-6 text-[var(--text-secondary)]">{message}</div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--card)] disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 rounded-lg px-4 py-2 text-white transition-colors disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isProcessing ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
