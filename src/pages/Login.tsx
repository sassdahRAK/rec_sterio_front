/**
 * Sign in (instruction.txt #2, #3): Google, the operator's email/password, or
 * continue as a guest. Guests can browse public datasets without an account.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, isMockEnabled, publicApi, setMockEnabled } from '../api/client';
import type { PublicConfig } from '../api/types';
import Spinner from '../components/Spinner';
import ThemeToggle from '../components/ThemeToggle';
import { btnNeutral, btnPrimary, inputCls, labelCls } from '../components/ui';
import { useAuthStore } from '../store/auth';

interface GoogleIdentity {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
let gisPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google Sign-In.'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demo, setDemo] = useState(isMockEnabled());
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const googleSlot = useRef<HTMLDivElement | null>(null);

  // Which sign-in options this deployment offers.
  useEffect(() => {
    if (demo) {
      setConfig({ google_enabled: false, guest_enabled: true, google_client_id: '' });
      return;
    }
    publicApi
      .config()
      .then(setConfig)
      .catch(() => setConfig({ google_enabled: false, guest_enabled: true, google_client_id: '' }));
  }, [demo]);

  // Render the official Google button when a client id is configured.
  useEffect(() => {
    if (!config?.google_enabled || !config.google_client_id || demo) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleSlot.current) return;
        const identity = window.google?.accounts?.id;
        if (!identity) throw new Error('Google Sign-In is unavailable.');
        identity.initialize({
          client_id: config.google_client_id,
          callback: (response) => {
            if (!response.credential) return;
            setBusy(true);
            setError(null);
            loginWithGoogle(response.credential)
              .then(() => navigate('/dataset', { replace: true }))
              .catch((err) => {
                const apiError = err as ApiError;
                setError({
                  code: apiError instanceof ApiError ? apiError.code : 'google_failed',
                  message:
                    apiError instanceof ApiError
                      ? apiError.message
                      : 'Google sign-in failed. Try the email form instead.',
                });
              })
              .finally(() => setBusy(false));
          },
        });
        identity.renderButton(googleSlot.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        });
        setGoogleReady(true);
      })
      .catch((err: Error) => setGoogleError(err.message));
    return () => {
      cancelled = true;
    };
  }, [config, demo, loginWithGoogle, navigate]);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMockEnabled(demo);
      await login(email.trim(), password);
      navigate('/dataset', { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setError({
        code: apiError instanceof ApiError ? apiError.code : 'unexpected_error',
        message:
          apiError instanceof ApiError
            ? apiError.message
            : 'Could not reach the RecSterio API. Check that the backend is running.',
      });
    } finally {
      setBusy(false);
    }
  };

  const asGuest = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setMockEnabled(demo);
      await continueAsGuest();
      navigate('/dataset', { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setError({
        code: apiError instanceof ApiError ? apiError.code : 'guest_failed',
        message:
          apiError instanceof ApiError
            ? apiError.message
            : 'Could not start a guest session.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Every hook above has run, so the render order is stable. Redirecting before
  // the hooks would change it the moment `login()` flips `isAuthenticated`, and
  // React would unmount the whole tree instead of navigating.
  if (isAuthenticated) return <Navigate to="/dataset" replace />;

  return (
    <div className="portal-wash flex min-h-screen items-center justify-center bg-base px-4 py-10 text-fg">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <img
            // BASE_URL keeps the asset under /console/ in the deployed build.
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            width={34}
            height={34}
            className="h-[34px] w-[34px] rounded-full ring-1 ring-line"
          />
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight">RecSterio</p>
            <p className="text-2xs uppercase tracking-[0.18em] text-faint">Khmer–English dataset</p>
          </div>
        </div>

        <div className="card p-5">
          <h1 className="font-display text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-faint">
            Members can edit and comment on folders shared with them. The operator account manages
            the whole dataset.
          </p>

          {config?.google_enabled && !demo ? (
            <div className="mt-4">
              <div ref={googleSlot} className="flex min-h-[40px] justify-center" />
              {!googleReady && !googleError ? (
                <p className="text-center text-2xs text-faint">Loading Google Sign-In…</p>
              ) : null}
              {googleError ? <p className="text-center text-2xs text-bad">{googleError}</p> : null}
              {!googleReady ? null : (
                <div className="my-4 flex items-center gap-3 text-2xs uppercase tracking-wider text-faint">
                  <span className="h-px flex-1 bg-line" />
                  or with a password
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={demo}
                onChange={(event) => setDemo(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-line bg-raised text-accent focus:ring-accent/40"
              />
              Use demo data (mock API, no backend required)
            </label>

            {error ? (
              <div role="alert" className="rounded-md border border-bad/40 bg-bad-soft/60 px-3 py-2.5">
                <p className="font-mono text-2xs uppercase tracking-wider text-bad">{error.code}</p>
                <p className="mt-0.5 text-sm text-fg">{error.message}</p>
              </div>
            ) : null}

            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 border-t border-line pt-3.5">
            <button type="button" onClick={() => void asGuest()} disabled={busy} className={`${btnNeutral} w-full`}>
              Continue as guest
            </button>
            <p className="mt-2 text-center text-2xs text-faint">
              Guests can browse public datasets and open a private folder with a passcode.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-2xs leading-relaxed text-faint">
          Demo mode accepts any email with a valid-looking address and a password of four characters or more.
        </p>
      </div>
    </div>
  );
}
