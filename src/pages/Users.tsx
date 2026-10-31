/**
 * The Users page (super_admin only): every console account, its role and its
 * active state. Roles are changed in-row with a select, mirroring the share
 * dialog's member table; deactivation is confirmed because it locks the
 * account out of the console until a super admin reactivates it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, retryGet, usersApi } from '../api/client';
import type { AdminUser, UserListQuery } from '../api/types';
import { CONSOLE_ROLES } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { ALL_ROWS } from '../components/Pagination';
import Spinner from '../components/Spinner';
import UserDialog from '../components/UserDialog';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  LockIcon,
  RefreshIcon,
  SearchIcon,
  UserPlusIcon,
} from '../components/icons';
import {
  btnNeutral,
  btnPrimary,
  iconActionCls,
  iconBtnCls,
  inputCls,
  labelCls,
  selectCls,
  tableCellCls,
  tableHeadCls,
} from '../components/ui';
import { formatRelative } from '../lib/format';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

const PAGE_SIZES = [10, 20, 50, 100, ALL_ROWS];

/** The root row is server-locked (403 root_account_locked) — shown, not edited. */
const ROOT_LOCK_HINT = 'Root account: cannot be edited';

export default function Users() {
  const email = useAuthStore((s) => s.email);
  const [query, setQuery] = useState<UserListQuery>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<AdminUser | null>(null);

  // Debounce the free-text search so every keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A debounced search can overlap a newer one, and a slow background poll can
  // land after a manual refresh. Ordering is decided by `lastAppliedSeq`: any
  // successful response newer than the last one applied is used — crucially, a
  // duplicate StrictMode mount request whose twin already succeeded is not
  // treated as "stale". A failure never overwrites applied rows; it only sets
  // the error banner, which renders solely when there are no rows to keep.
  // `silent` (the poll) skips the spinner and swallows errors. Non-silent
  // loads retry twice (1s/3s) before the banner.
  const reqSeq = useRef(0);
  const lastAppliedSeq = useRef(0);
  const load = useCallback(
    (silent = false): void => {
      const seq = ++reqSeq.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const run = () => usersApi.list(query);
      (silent ? run() : retryGet(run))
        .then((result) => {
          if (seq < lastAppliedSeq.current) return;
          lastAppliedSeq.current = seq;
          setUsers(result.items);
          setTotal(result.total);
          setError(null);
        })
        .catch((err: unknown) => {
          if (seq < lastAppliedSeq.current) return;
          // Keep the visible rows; the banner only renders without data, so a
          // blip over a loaded table is invisible.
          if (!silent) setError(err);
        })
        .finally(() => {
          if (seq === reqSeq.current && !silent) setLoading(false);
        });
    },
    [query],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Accounts change slowly (a Telegram user signing in for the first time), so
  // a gentler 30s poll; silent refresh keeps filters and scroll untouched.
  useAutoRefresh(load, { intervalMs: 30000 });

  const isSelf = (user: AdminUser): boolean => user.email === email;

  const changeRole = async (user: AdminUser, role: AdminUser['role']): Promise<void> => {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      const updated = await usersApi.patch(user.id, { role });
      toast.success(`${updated.email} is now ${updated.role}. It applies on their next request.`);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
      // Re-sync the select with what the server actually kept.
      load();
    } finally {
      setBusyId(null);
    }
  };

  const activate = async (user: AdminUser): Promise<void> => {
    setBusyId(user.id);
    try {
      const updated = await usersApi.patch(user.id, { is_active: true });
      toast.success(`Reactivated ${updated.email}. They can sign in again.`);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (): Promise<void> => {
    if (!target) return;
    setBusyId(target.id);
    try {
      const updated = await usersApi.patch(target.id, { is_active: false });
      toast.success(`Deactivated ${updated.email}. They cannot sign in until reactivated.`);
      setTarget(null);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  // Shared by the table and the phone card list so the two never drift.
  // The root row shows a lock chip instead of the select: the API answers
  // 403 root_account_locked for any privilege edit, so offering the select
  // would only invite the refusal toast.
  const roleSelect = (user: AdminUser) =>
    user.is_root ? (
      <span
        className="chip inline-flex items-center gap-1 border-line bg-raised text-dim"
        title={ROOT_LOCK_HINT}
      >
        <LockIcon size={12} />
        {user.role}
        <span className="sr-only">{ROOT_LOCK_HINT}</span>
      </span>
    ) : (
      <select
        value={user.role}
        onChange={(e) => void changeRole(user, e.target.value as AdminUser['role'])}
        aria-label={`Role for ${user.email}`}
        disabled={busyId === user.id || isSelf(user)}
        title={isSelf(user) ? 'You cannot change your own role' : undefined}
        className={`${selectCls} py-1 text-xs`}
      >
        {CONSOLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    );

  const statusAction = (user: AdminUser) =>
    user.is_root ? null : user.is_active ? (
      <button
        type="button"
        onClick={() => setTarget(user)}
        disabled={busyId === user.id || isSelf(user)}
        aria-label={`Deactivate ${user.email}`}
        title={isSelf(user) ? 'You cannot deactivate your own account' : 'Deactivate'}
        className={iconActionCls('bad')}
      >
        <CloseIcon size={15} />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => void activate(user)}
        disabled={busyId === user.id || isSelf(user)}
        aria-label={`Reactivate ${user.email}`}
        title={isSelf(user) ? 'You cannot change your own active state' : 'Reactivate'}
        className={iconActionCls('ok')}
      >
        <CheckIcon size={15} />
      </button>
    );

  const statusValue = query.is_active === undefined ? '' : query.is_active ? 'active' : 'inactive';
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const summary = loading ? 'Loading…' : `${total} account${total === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="shrink-0">
          <h2 className="break-words font-display text-2xl font-bold tracking-tight text-fg">Users</h2>
          <p className="mt-0.5 text-sm text-dim">{summary}</p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email or name"
            aria-label="Search users"
            className={`${inputCls} rounded-full py-2 pl-9`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh"
            title="Refresh"
            className={`${btnNeutral} rounded-full`}
          >
            <RefreshIcon size={15} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Add user"
            title="Add user"
            className={`${btnPrimary} rounded-full`}
          >
            <UserPlusIcon size={15} />
            <span className="hidden sm:inline">Add user</span>
          </button>
        </div>
      </div>

      <p className="text-2xs text-faint">
        Role changes apply immediately. The user's next request uses the new role.
      </p>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          {/* The label restates the default option ("All roles"), so it hides on
              phone; the select keeps its accessible name via aria-label. */}
          <label htmlFor="user-role-filter" className={`${labelCls} hidden sm:block`}>
            Role
          </label>
          <select
            id="user-role-filter"
            aria-label="Filter by role"
            value={query.role ?? ''}
            onChange={(e) =>
              setQuery((prev) => ({ ...prev, role: e.target.value || undefined, page: 1 }))
            }
            className={`${selectCls} w-full`}
          >
            <option value="">All roles</option>
            {CONSOLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="user-status-filter" className={`${labelCls} hidden sm:block`}>
            Status
          </label>
          <select
            id="user-status-filter"
            aria-label="Filter by status"
            value={statusValue}
            onChange={(e) =>
              setQuery((prev) => ({
                ...prev,
                is_active: e.target.value === '' ? undefined : e.target.value === 'active',
                page: 1,
              }))
            }
            className={`${selectCls} w-full`}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </div>
      </div>

      {error && users.length === 0 ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : null}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16">
            <Spinner className="h-5 w-5" />
            <span className="text-sm text-dim">Loading accounts…</span>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No accounts match these filters"
            description="Try clearing the search box or widening the role and status filters."
          />
        ) : (
          <>
            {/* Phones get a compact divided list — the table would force a
                horizontal scroll at 360px. md+ switches back to the table. */}
            <div className="divide-y divide-line-soft md:hidden">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg" title={user.email}>
                      {user.email}
                    </p>
                    <p className="mt-0.5 truncate text-2xs text-faint">
                      <span className={user.is_active ? 'text-ok' : 'text-bad'}>
                        {user.is_active ? 'Active' : 'Deactivated'}
                      </span>
                      {user.name ? ` · ${user.name}` : ''} · {formatRelative(user.created_at)}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">{roleSelect(user)}</div>
                  {statusAction(user)}
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-line bg-raised/40">
                  <tr>
                    <th scope="col" className={tableHeadCls}>Email</th>
                    <th scope="col" className={tableHeadCls}>Role</th>
                    <th scope="col" className={tableHeadCls}>Status</th>
                    <th scope="col" className={`${tableHeadCls} hidden lg:table-cell`}>Telegram</th>
                    <th scope="col" className={`${tableHeadCls} hidden lg:table-cell`}>Created</th>
                    <th scope="col" className={`${tableHeadCls} text-right`}>
                      Actions
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-line-soft">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-raised/40">
                    <td className={tableCellCls}>
                      <p className="max-w-[14rem] truncate font-medium text-fg" title={user.email}>
                        {user.email}
                      </p>
                      {user.name ? (
                        <p className="mt-0.5 max-w-[14rem] truncate text-2xs text-faint">{user.name}</p>
                      ) : null}
                    </td>
                    <td className={tableCellCls}>{roleSelect(user)}</td>
                    <td className={tableCellCls}>
                      <span
                        className={`chip ${
                          user.is_active
                            ? 'border-ok/40 bg-ok-soft text-ok'
                            : 'border-bad/40 bg-bad-soft text-bad'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className={`${tableCellCls} hidden whitespace-nowrap font-mono text-xs lg:table-cell`}>
                      {user.telegram_user_id ? (
                        user.telegram_user_id
                      ) : (
                        <span className="text-faint">None</span>
                      )}
                    </td>
                    <td className={`${tableCellCls} hidden whitespace-nowrap text-xs lg:table-cell`}>
                      {formatRelative(user.created_at)}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      <div className="flex items-center justify-end">{statusAction(user)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        {!loading && users.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
            <label className="flex items-center gap-1.5 text-xs text-faint">
              Rows
              <select
                value={pageSize}
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, page_size: Number(e.target.value), page: 1 }))
                }
                aria-label="Rows per page"
                className="tap-pad rounded border border-line bg-raised px-1.5 py-1 text-xs text-dim outline-none focus:border-accent"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size === ALL_ROWS ? 'All' : size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQuery((prev) => ({ ...prev, page: page - 1 }))}
                disabled={page <= 1}
                aria-label="Previous page"
                title="Previous page"
                className={iconBtnCls}
              >
                <ChevronLeftIcon size={15} />
              </button>
              <span className="px-1 font-mono text-xs text-dim">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setQuery((prev) => ({ ...prev, page: page + 1 }))}
                disabled={page >= pageCount}
                aria-label="Next page"
                title="Next page"
                className={iconBtnCls}
              >
                <ChevronRightIcon size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <UserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(user) => {
          toast.success(`Account created for ${user.email} (${user.role}).`);
          void load();
        }}
      />

      <ConfirmDialog
        open={target !== null}
        destructive
        title="Deactivate this account?"
        message={
          target
            ? `${target.email} will not be able to sign in until reactivated. Their data and role stay untouched.`
            : ''
        }
        confirmLabel="Deactivate account"
        busy={busyId !== null}
        onConfirm={() => void deactivate()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}