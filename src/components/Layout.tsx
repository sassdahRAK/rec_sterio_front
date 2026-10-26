import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isMockEnabled } from '../api/client';
import { useAuthStore } from '../store/auth';
import Sidebar from './Sidebar';
import Toast from './Toast';
import { btnNeutral } from './ui';

const routeTitles: Record<string, string> = {
  '/overview': 'Overview',
  '/videos': 'Videos',
  '/jobs': 'Jobs',
};

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.email);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const title = location.pathname.startsWith('/videos/') ? 'Video detail' : routeTitles[location.pathname] ?? 'recsterio';

  return (
    <div className="flex min-h-screen bg-base text-fg">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="relative z-10 h-full">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-base/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`${btnNeutral} px-2 py-1.5 lg:hidden`}
            aria-label="Open navigation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <h1 className="font-display text-sm font-semibold tracking-tight text-fg">{title}</h1>

          <div className="ml-auto flex items-center gap-3">
            {isMockEnabled() ? (
              <span className="rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-warn">
                demo data
              </span>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-2xs uppercase tracking-[0.14em] text-faint">Signed in</p>
              <p className="max-w-[16rem] truncate text-xs text-dim">{email ?? 'unknown'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className={btnNeutral}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>

      <Toast />
    </div>
  );
}
