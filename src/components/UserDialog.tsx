/**
 * Create a console account (the Users page, super_admin only). Collects the
 * four fields the API needs and maps its error codes to plain sentences, so
 * a duplicate email reads as an explanation instead of a code.
 */
import { useEffect, useState } from 'react';
import { ApiError, usersApi } from '../api/client';
import type { AdminUser, Role } from '../api/types';
import { CONSOLE_ROLES } from '../api/types';
import Modal from './Modal';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from './ui';

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the account is created so the caller can toast and reload. */
  onCreated: (user: AdminUser) => void;
}

export default function UserDialog({ open, onClose, onCreated }: UserDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form every time the dialog opens; the Modal focuses the email field.
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setName('');
    setRole('user');
    setPassword('');
    setError(null);
  }, [open]);

  if (!open) return null;

  const submit = async (): Promise<void> => {
    if (password.length < 8) {
      setError('The password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await usersApi.create({
        email: email.trim(),
        name: name.trim() || null,
        role,
        password,
      });
      onCreated(user);
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      const code = apiError instanceof ApiError ? apiError.code : '';
      if (code === 'duplicate_email') {
        setError('That email already has an account.');
      } else if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError('Could not create the account.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Add user"
      description="Create a console account and set its role."
      onClose={onClose}
      busy={busy}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="user-email" className={labelCls}>
            Email
          </label>
          <input
            id="user-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="user-name" className={labelCls}>
            Name (optional)
          </label>
          <input
            id="user-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="user-role" className={labelCls}>
            Role
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={`${selectCls} w-full`}
          >
            {CONSOLE_ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="user-password" className={labelCls}>
            Password
          </label>
          <input
            id="user-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputCls}
          />
          <p className="mt-1.5 text-2xs text-faint">At least 8 characters.</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={btnNeutral}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !email.trim() || !password}
            className={btnPrimary}
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </div>
    </Modal>
  );
}