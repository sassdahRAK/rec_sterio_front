/** Shared class strings so every control in the console looks the same. */

export const card = 'rounded-lg border border-line bg-card shadow-panel';

export const inputCls =
  'tap-pad w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-fg placeholder:text-faint ' +
  'outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50';

export const selectCls =
  'tap-pad w-full appearance-none rounded-md border border-line bg-raised px-3 py-2 pr-8 text-sm text-fg ' +
  "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] " +
  'bg-[length:12px_12px] bg-[position:right_0.6rem_center] bg-no-repeat ' +
  'outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50';

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

/* ---- Icon-only buttons ----------------------------------------------------
 * `iconBtnCls` is the neutral base for every icon-only control (row actions,
 * toolbars, pagination). Desktop is a compact h-9 w-9 square; `tap-pad` lifts
 * it to 44x44 on coarse pointers (see index.css), so no wrapper is needed.
 * Colour is carried by the base (text-dim → hover text-fg); tinted row
 * actions use `iconActionCls(variant)` instead so the state color never
 * fights the base. */

const iconBtnBase =
  'tap-pad inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line ' +
  'bg-card transition-colors duration-150 focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40';

export const iconBtnCls = `${iconBtnBase} text-dim hover:bg-raised hover:text-fg`;

export type IconActionVariant = 'neutral' | 'ok' | 'warn' | 'bad';

const iconActionColor: Record<IconActionVariant, string> = {
  neutral: 'text-dim hover:bg-raised hover:text-fg',
  ok: 'text-ok hover:border-ok/50 hover:bg-ok-soft hover:text-ok',
  warn: 'text-warn hover:border-warn/50 hover:bg-warn-soft hover:text-warn',
  bad: 'text-bad hover:border-bad/50 hover:bg-bad-soft hover:text-bad',
};

/** Tinted icon-only row action: neutral (default) / ok / warn / bad. */
export function iconActionCls(variant: IconActionVariant = 'neutral'): string {
  return `${iconBtnBase} ${iconActionColor[variant]}`;
}
