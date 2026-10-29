/**
 * Sign in to the operations console (instruction.txt #2): Google or the
 * operator's email/password.
 *
 * There is deliberately no guest option here. The console is the operator
 * surface — it lists every folder and the whole job queue — so a guest session
 * would be bounced straight back to this page by `RequireAuth`. Guest browsing
 * belongs to the public portal, which is a separate app.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, isMockEnabled, publicApi, setMockEnabled } from '../api/client';
import type { PublicConfig } from '../api/types';
import Spinner from '../components/Spinner';
import ThemeToggle from '../components/ThemeToggle';
import { btnPrimary, inputCls, labelCls } from '../components/ui';
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

/** Static waveform silhouette for the brand panel; animated unless the user
 * asked for reduced motion (the CSS media query kills the animation). */
const WAVE_HEIGHTS = [
  10, 18, 32, 52, 74, 58, 36, 64, 88, 70, 44, 26, 48, 72, 92, 66, 40, 22, 38, 56, 34, 20, 12, 8,
];

function Waveform() {
  return (
    <div aria-hidden="true" className="flex h-24 items-end gap-[3px]">
      {WAVE_HEIGHTS.map((h, i) => (
        <span
          key={i}
          className="w-[5px] flex-none origin-bottom rounded-full bg-accent/70 animate-pulse-bar"
          style={{ height: `${h}%`, animationDelay: `${(i % 6) * 0.18}s` }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Every hook above has run, so the render order is stable. Redirecting before
  // the hooks would change it the moment `login()` flips `isAuthenticated`, and
  // React would unmount the whole tree instead of navigating.
  if (isAuthenticated) return <Navigate to="/dataset" replace />;

  return (
    <div className="grid min-h-screen bg-base text-fg lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — the console's identity, not decoration. */}
      <aside className="relative hidden overflow-hidden bg-card lg:flex lg:flex-col lg:justify-between lg:border-r lg:border-line lg:p-10 xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90rem_45rem_at_15%_115%,rgb(var(--c-accent)/0.16),transparent_60%)]"
        />
        <header className="relative flex items-center gap-3">
          <img
            // BASE_URL keeps the asset under /console/ in the deployed build.
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full ring-1 ring-line"
          />
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-tight">RecSterio</p>
            <p className="text-2xs uppercase tracking-[0.18em] text-faint">Khmer–English dataset</p>
          </div>
        </header>

        <div className="relative max-w-md">
          <Waveform />
          <h2 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            The operations console for the dataset.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            Every folder, share link, passcode and transcription job — managed from one place.
            Recording ingestion runs around the clock; this is where you watch it and fix it.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-dim">
            {[
              'Ingest, review and correct transcripts',
              'Curate dataset folders and exports',
              'Issue share links and passcodes',
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative font-mono text-2xs text-faint">
          ops console · v1
        </footer>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              width={34}
              height={34}
              className="h-[34px] w-[34px] rounded-full ring-1 ring-line"
            />
            <p className="font-display text-base font-bold tracking-tight">RecSterio</p>
          </div>

          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-faint">
            Operator access
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-dim">
            This account manages folders, shares and the job queue. To browse the dataset as a
            visitor, use the public portal instead.
          </p>

          {config?.google_enabled && !demo ? (
            <div className="mt-6">
              <div ref={googleSlot} className="flex min-h-[40px] justify-center" />
              {!googleReady && !googleError ? (
                <p className="text-center text-2xs text-faint">Loading Google Sign-In…</p>
              ) : null}
              {googleError ? <p className="text-center text-2xs text-bad">{googleError}</p> : null}
              {!googleReady ? null : (
                <div className="my-5 flex items-center gap-3 text-2xs uppercase tracking-wider text-faint">
                  <span className="h-px flex-1 bg-line" />
                  or with a password
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-faint transition-colors hover:text-dim focus:outline-none focus-visible:text-accent"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.6a2.8 2.8 0 0 0 3.8 3.8M6.6 6.8C4.6 8.1 3.2 10 2.5 12c1.4 3.8 4.8 6.5 9.5 6.5 1.7 0 3.2-.3 4.6-1M7 5.2C8.5 4.7 10.2 4.5 12 4.5c4.7 0 8.1 2.7 9.5 6.5-.5 1.4-1.3 2.6-2.3 3.6"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M2.5 12C4 8.2 7.4 5.5 12 5.5s8 2.7 9.5 6.5C19 15.8 15.6 18.5 12 18.5s-7.6-2.7-9.5-6.5Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={demo}
                onChange={(event) => setDemo(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-line bg-raised text-accent focus:ring-accent/40"
              />
              Explore with demo data (no server needed)
            </label>

            {error ? (
              <div role="alert" className="rounded-md border border-bad/40 bg-bad-soft/60 px-3 py-2.5">
                <p className="font-mono text-2xs uppercase tracking-wider text-bad">{error.code}</p>
                <p className="mt-0.5 text-sm text-fg">{error.message}</p>
              </div>
            ) : null}

            <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-2.5 text-base`}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-xs leading-relaxed text-faint">
            Demo mode is a safe sandbox: any valid-looking email address works with a password of
            four characters or more, and nothing is sent to a server.
          </p>
        </div>
      </main>
    </div>
  );
}
