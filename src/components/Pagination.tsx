import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/* Same look as `iconBtnCls` (ui.ts), but width-flexible so the label can sit
 * next to the chevron from sm up. On phones it collapses to a 36px square
 * (44px on touch via tap-pad) and the label hides. */
const navBtnCls =
  'tap-pad inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-line ' +
  'bg-card px-2 text-dim transition-colors duration-150 focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-raised hover:text-fg';

/** Page size that means "everything in one page"; rendered as "All". */
export const ALL_ROWS = 1000;

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  itemLabel?: string;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50, 100],
  itemLabel = 'items',
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
      <p className="text-xs text-faint">
        Showing <span className="font-mono text-dim">{from}</span> to <span className="font-mono text-dim">{to}</span> of{' '}
        <span className="font-mono text-dim">{total}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-faint">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="tap-pad rounded border border-line bg-raised px-1.5 py-1 text-xs text-dim outline-none focus:border-accent"
              aria-label="Rows per page"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size === ALL_ROWS ? 'All' : size}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={navBtnCls}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeftIcon size={15} />
            <span className="hidden text-xs font-medium sm:inline">Prev</span>
          </button>
          <span className="px-2 font-mono text-xs text-dim">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className={navBtnCls}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRightIcon size={15} />
            <span className="hidden text-xs font-medium sm:inline">Next</span>
          </button>
        </div>
      </div>
    </div>
  );
}
