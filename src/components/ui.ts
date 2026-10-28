/** Shared class strings so every control in the console looks the same. */

export const card = 'rounded-lg border border-line bg-card shadow-panel';

export const inputCls =
  'tap-pad w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-fg placeholder:text-faint ' +
  'outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50';

export const selectCls =
  'tap-pad appearance-none rounded-md border border-line bg-raised px-3 py-2 pr-8 text-sm text-fg outline-none ' +
  'transition focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50';

export const btnBase =
  'tap-pad inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${btnBase} border-accent/60 bg-accent/15 text-accent hover:bg-accent/25`;

export const btnNeutral = `${btnBase} border-line bg-raised text-dim hover:border-line hover:bg-line/40 hover:text-fg`;

export const btnDanger = `${btnBase} border-bad/50 bg-bad/10 text-bad hover:bg-bad/20`;

export const btnGhost = `${btnBase} border-transparent bg-transparent text-dim hover:bg-raised hover:text-fg`;

export const labelCls =
  'mb-1.5 block text-2xs font-semibold uppercase tracking-[0.14em] text-faint';

export const tableHeadCls =
  'whitespace-nowrap px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-faint';

export const tableCellCls = 'px-3 py-2.5 align-middle text-sm text-dim';
