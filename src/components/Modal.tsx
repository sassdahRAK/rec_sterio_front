/** A small dialog shell: backdrop, escape-to-close, focus trap-ish behaviour. */
import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  busy?: boolean;
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  width = 'md',
  busy = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([data-close])',
    );
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 max-h-[92vh] w-full ${widths[width]} overflow-y-auto rounded-t-2xl border border-line bg-card p-5 shadow-glow sm:rounded-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
            {description ? <p className="mt-1 text-xs text-dim">{description}</p> : null}
          </div>
          <button
            type="button"
            data-close
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="icon-btn"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
