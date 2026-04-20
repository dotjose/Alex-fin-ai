import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type AppModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel max width */
  size?: "sm" | "md" | "lg";
  /** When false, only title row is shown (footer handles dismiss). */
  showHeaderClose?: boolean;
};

const sizeMaxW: Record<NonNullable<AppModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

let bodyScrollLockCount = 0;
let preservedBodyOverflow = "";

function acquireBodyScrollLock() {
  if (typeof document === "undefined") return;
  if (bodyScrollLockCount === 0) {
    preservedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount += 1;
}

function releaseBodyScrollLock() {
  if (typeof document === "undefined") return;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = preservedBodyOverflow;
  }
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

function AppModalInner({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  showHeaderClose = true,
}: AppModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      setEntered(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    acquireBodyScrollLock();
    return () => releaseBodyScrollLock();
  }, [open]);

  useEffect(() => {
    if (!open || !entered) return;
    const panel = panelRef.current;
    if (!panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusable = getFocusable(panel);
    (focusable[0] ?? panel).focus();

    return () => {
      prev?.focus?.();
    };
  }, [open, entered]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = getFocusable(panel);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const onBackdropPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!entered) return;
      if (e.target === e.currentTarget) onClose();
    },
    [onClose, entered],
  );

  const maxW = sizeMaxW[size];
  const interactive = open && entered;
  const panelOpacity = entered ? 1 : 0;
  const panelScale = entered ? 1 : 0.96;

  return (
    <div
      className="fixed inset-0 flex min-w-0 flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      style={{
        zIndex: "var(--z-modal, 1000)",
        pointerEvents: open ? "auto" : "none",
      }}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200 ease-out"
        style={{
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: panelOpacity,
        }}
        onPointerDown={open ? onBackdropPointerDown : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex min-h-0 w-full min-w-0 flex-col rounded-t-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card-hover)] sm:mx-auto sm:max-h-[min(85dvh,720px)] sm:rounded-[var(--radius-card)] ${maxW} max-h-[min(92dvh,720px)]`}
        style={{
          opacity: panelOpacity,
          transform: `scale(${panelScale})`,
          transition:
            "opacity 180ms ease-out, transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: interactive ? "auto" : "none",
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
          <h2
            id={titleId}
            className="min-w-0 break-words pr-2 text-base font-semibold text-[var(--text-primary)] sm:text-lg"
          >
            {title}
          </h2>
          {showHeaderClose ? (
            <button
              type="button"
              onClick={onClose}
              className="ds-btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-4">
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Dialog rendered via `createPortal` to `document.body` (above layout / z-index traps).
 * Keep mounted in parent JSX; drive visibility with `open` only — do not `{open && <AppModal />}`.
 */
export function AppModal(props: AppModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(<AppModalInner {...props} />, document.body);
}
