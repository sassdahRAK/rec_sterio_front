/**
 * The Users page (super_admin only): every console account, its role and its
 * active state. Roles are changed in-row with a select, mirroring the share
 * dialog's member table; deactivation is confirmed because it locks the
 * account out of the console until a super admin reactivates it.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, usersApi } from '../api/client';
import type { AdminUser, UserListQuery } from '../api/types';
import { CONSOLE_ROLES } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Pagination, { ALL_ROWS } from '../components/Pagination';
import Spinner from '../components/Spinner';
import UserDialog from '../components/UserDialog';
import { SearchIcon } from '../components/icons';
import {
  btnDanger,
  btnNeutral,
  btnPrimary,
  inputCls,
  labelCls,
  selectCls,
  tableCellCls,
  tableHeadCls,
} from '../components/ui';
import { formatRelative } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

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

  // Returns a cleanup function so the effect can cancel it. A debounced search
  // can overlap a newer one; without the guard, whichever resolves last wins.
  const load = useCallback((): (() => void) => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    usersApi
      .list(query)
      .then((result) => {
        if (cancelled) return;
        setUsers(result.items);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
        setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => load(), [load]);

  const isSelf = (user: AdminUser): boolean => user.email === email;

  const changeRole = async (user: AdminUser, role: AdminUser['role']): Promise<void> => {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      const updated = await usersApi.patch(user.id, { role });
      toast.success(`${updated.email} is now ${updated.role} — it applies on their next request.`);
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
      toast.success(`Reactivated ${updated.email} — they can sign in again.`);
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
      toast.success(`Deactivated ${updated.email} — they cannot sign in until reactivated.`);
      setTarget(null);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  const statusValue = query.is_active === undefined ? '' : query.is_active ? 'active' : 'inactive';
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;

  const summary = loading ? 'Loading…' : `${total} account${total === 1 ? '' : 's'}`;

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="shrink-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">Users</h2>
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
          <button type="button" onClick={() => void load()} className={`${btnNeutral} rounded-full`}>
            Refresh
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className={`${btnPrimary} rounded-full`}>
            Add user
          </button>
        </div>
      </div>

      <p className="text-2xs text-faint">
        Role changes apply immediately — the user's next request uses the new role.
      </p>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="user-role-filter" className={labelCls}>
            Role
          </label>
          <select
            id="user-role-filter"
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
          <label htmlFor="user-status-filter" className={labelCls}>
            Status
          </label>
          <select
            id="user-status-filter"
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

      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <thead className="border-b border-line bg-raised/40">
                <tr>
                  <th scope="col" className={tableHeadCls}>Email</th>
                  <th scope="col" className={tableHeadCls}>Role</th>
                  <th scope="col" className={tableHeadCls}>Status</th>
                  <th scope="col" className={tableHeadCls}>Telegram</th>
                  <th scope="col" className={tableHeadCls}>Created</th>
                  <th scope="col" className={`${tableHeadCls} sticky right-0 border-l border-line bg-card text-right`}>
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
                    <td className={tableCellCls}>
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
                    </td>
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
                    <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>
                      {user.telegram_user_id ? (
                        user.telegram_user_id
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className={`${tableCellCls} whitespace-nowrap text-xs`}>
                      {formatRelative(user.created_at)}
                    </td>
                    <td className={`${tableCellCls} sticky right-0 border-l border-line bg-card text-right`}>
                      {user.is_active ? (
                        <button
                          type="button"
                          onClick={() => setTarget(user)}
                          disabled={busyId === user.id || isSelf(user)}
                          title={isSelf(user) ? 'You cannot deactivate your own account' : undefined}
                          className={`${btnDanger} px-2 py-1 text-xs`}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void activate(user)}
                          disabled={busyId === user.id || isSelf(user)}
                          title={isSelf(user) ? 'You cannot change your own active state' : undefined}
                          className={`${btnNeutral} px-2 py-1 text-xs`}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && users.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel="users"
            pageSizes={[10, 20, 50, 100, ALL_ROWS]}
            onPageChange={(next) => setQuery((prev) => ({ ...prev, page: next }))}
            onPageSizeChange={(size) => setQuery((prev) => ({ ...prev, page_size: size, page: 1 }))}
          />
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
        confirmLabel="Deactivate"
        busy={busyId !== null}
        onConfirm={() => void deactivate()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}