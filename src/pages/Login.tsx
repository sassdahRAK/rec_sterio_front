import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, isMockEnabled, setMockEnabled } from '../api/client';
import { useAuthStore } from '../store/auth';
import Spinner from '../components/Spinner';
import { btnPrimary, inputCls, labelCls } from '../components/ui';

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demo, setDemo] = useState(isMockEnabled());
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMockEnabled(demo);
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setError({
        code: apiError instanceof ApiError ? apiError.code : 'unexpected_error',
        message:
          apiError instanceof ApiError
            ? apiError.message
            : 'Could not reach the recsterio API. Check that the backend is running.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10 text-fg">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 font-display text-base font-bold text-accent">
            r
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">recsterio</p>
            <p className="text-2xs uppercase tracking-[0.18em] text-faint">operations console</p>
          </div>
        </div>

        <div className="card p-5">
          <h1 className="font-display text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-faint">
            Admin access. Telegram submissions are attributed to the bot service token.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="email" className={labelCls}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@recsterio.local"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelCls}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line bg-raised text-accent focus:ring-accent/40"
              />
              Use demo data (mock API, no backend required)
            </label>

            {error ? (
              <div
                role="alert"
                className="rounded-md border border-bad/40 bg-bad-soft/60 px-3 py-2.5"
              >
                <p className="font-mono text-2xs uppercase tracking-wider text-bad">{error.code}</p>
                <p className="mt-0.5 text-sm text-fg">{error.message}</p>
              </div>
            ) : null}

            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-2xs leading-relaxed text-faint">
          Demo mode accepts any email with a valid-looking address and a password of four characters or more.
        </p>
      </div>
    </div>
  );
}
