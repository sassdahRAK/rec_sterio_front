import { useToastStore } from '../store/toast';

const kindStyles: Record<string, { wrap: string; label: string }> = {
  error: { wrap: 'border-bad/40 bg-bad-soft/90 text-bad', label: 'Error' },
  success: { wrap: 'border-ok/40 bg-ok-soft/90 text-ok', label: 'Done' },
  info: { wrap: 'border-info/40 bg-info-soft/90 text-info', label: 'Note' },
};

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const style = kindStyles[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-toast-in rounded-lg border px-3.5 py-2.5 shadow-panel backdrop-blur ${style.wrap}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-2xs uppercase tracking-wider opacity-80">
                  {t.code ? `${style.label} · ${t.code}` : style.label}
                </p>
                <p className="mt-0.5 text-sm text-fg">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="tap-pad rounded p-1 text-faint transition hover:text-fg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
