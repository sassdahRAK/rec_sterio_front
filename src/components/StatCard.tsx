import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'ok' | 'bad' | 'warn' | 'info';
  icon?: ReactNode;
  footer?: ReactNode;
}

const toneRing: Record<string, string> = {
  default: 'text-fg',
  ok: 'text-ok',
  bad: 'text-bad',
  warn: 'text-warn',
  info: 'text-info',
};

export default function StatCard({ label, value, hint, tone = 'default', icon, footer }: StatCardProps) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
        {icon ? <span className={`shrink-0 opacity-70 ${toneRing[tone]}`}>{icon}</span> : null}
      </div>
      <p className={`font-display text-3xl font-semibold tabular-nums leading-none ${toneRing[tone]}`}>
        {value}
      </p>
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
      {footer ? <div className="mt-1 border-t border-line-soft pt-2">{footer}</div> : null}
    </div>
  );
}
