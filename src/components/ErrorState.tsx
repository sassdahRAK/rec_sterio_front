import { ApiError } from '../api/client';
import { btnNeutral } from './ui';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

function describe(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'unexpected_error', message: error.message };
  return { code: 'unexpected_error', message: 'Something went wrong while talking to the API.' };
}

export default function ErrorState({ error, onRetry, className = '' }: ErrorStateProps) {
  const { code, message } = describe(error);
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-lg border border-bad/40 bg-bad-soft/60 px-4 py-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-bad/50 text-[11px] font-bold text-bad">
          !
        </span>
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-wider text-bad/90">{code}</p>
          <p className="mt-0.5 text-sm text-fg">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`${btnNeutral} ml-8 py-1 text-xs`}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
