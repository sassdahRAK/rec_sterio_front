interface SpinnerProps {
  className?: string;
  label?: string;
  /** `inverse` is for spinners on a dark/accent fill (e.g. the play overlay). */
  tone?: 'accent' | 'inverse';
}

export default function Spinner({ className = 'h-4 w-4', label, tone = 'accent' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <svg
        className={`${className} animate-spin ${tone === 'inverse' ? 'text-white' : 'text-accent'}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
        />
      </svg>
      {label ? <span className="text-xs text-dim">{label}</span> : null}
    </span>
  );
}
