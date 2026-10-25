export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral' | 'violet';

const toneClasses: Record<Tone, string> = {
  ok: 'border-ok/30 bg-ok-soft text-ok',
  bad: 'border-bad/30 bg-bad-soft text-bad',
  warn: 'border-warn/30 bg-warn-soft text-warn',
  info: 'border-info/30 bg-info-soft text-info',
  neutral: 'border-neutral/30 bg-neutral-soft text-neutral',
  violet: 'border-violet/30 bg-violet-soft text-violet',
};

const dotClasses: Record<Tone, string> = {
  ok: 'bg-ok',
  bad: 'bg-bad',
  warn: 'bg-warn',
  info: 'bg-info',
  neutral: 'bg-neutral',
  violet: 'bg-violet',
};

/** One status vocabulary for the whole console — same colour, same meaning, everywhere. */
export function toneForStatus(status: string): Tone {
  switch (status) {
    case 'succeeded':
    case 'transcribed':
    case 'downloaded':
    case 'ready':
    case 'applied':
      return 'ok';
    case 'failed':
    case 'dead':
    case 'error':
      return 'bad';
    case 'quarantined':
    case 'cancelled':
      return 'warn';
    case 'running':
    case 'transcribing':
    case 'downloading':
      return 'info';
    case 'pending':
    case 'queued':
    case 'scheduled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

const toneBars: Record<Tone, string> = {
  ok: 'bg-ok',
  bad: 'bg-bad',
  warn: 'bg-warn',
  info: 'bg-info',
  neutral: 'bg-neutral',
  violet: 'bg-violet',
};

/** Bar/segment colour for a status, so charts match the badges. */
export function statusColor(status: string): string {
  return toneBars[toneForStatus(status)];
}

interface StatusBadgeProps {
  status: string;
  progress?: number | null;
  className?: string;
  label?: string;
}

export default function StatusBadge({ status, progress, className = '', label }: StatusBadgeProps) {
  const tone = toneForStatus(status);
  const showProgress = typeof progress === 'number' && progress > 0 && progress < 100;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]} ${status === 'running' || status === 'downloading' || status === 'transcribing' ? 'animate-pulse' : ''}`} />
      {label ?? status}
      {showProgress ? <span className="font-mono text-[10px] opacity-80">{progress}%</span> : null}
    </span>
  );
}

const sourceTone: Record<string, Tone> = {
  whisper: 'info',
  gemini: 'violet',
  manual: 'warn',
  merged: 'ok',
};

export function SourceBadge({ source, className = '' }: { source: string; className?: string }) {
  const tone = sourceTone[source] ?? 'neutral';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {source}
    </span>
  );
}

export function PlatformBadge({ platform, className = '' }: { platform: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs uppercase text-dim ${className}`}
    >
      {platform}
    </span>
  );
}
