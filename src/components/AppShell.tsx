/**
 * The portal chrome from the design reference: wordmark on the left, the three
 * work areas in the middle (Auto scrape / Dataset / Cleaned), and the identity
 * + theme controls on the right. Guests see the same shell (#3).
 */
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { isMockEnabled } from '../api/client';
import { useAuthStore } from '../store/auth';
import Toast from './Toast';
import ThemeToggle from './ThemeToggle';
import UnlockDialog from './UnlockDialog';
import { btnNeutral } from './ui';
import { KeyIcon } from './icons';

const TABS = [
  { to: '/scrape', label: 'Auto scrape' },
  { to: '/dataset', label: 'Dataset' },
  { to: '/cleaned', label: 'Cleaned' },
];

function Identity() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 text-xs text-dim sm:inline-flex">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-raised text-[10px] font-semibold text-dim">
            G
          </span>
          Guest User
        </span>
        <Link to="/login" className={`${btnNeutral} px-2.5 py-1.5 text-xs`}>
          Sign in
        </Link>
      </div>
    );
  }

  const label = name || email || (role === 'member' ? 'Member' : 'Admin');
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 rounded-full border border-line bg-card px-1.5 py-1 pr-2.5 text-xs text-fg transition hover:bg-raised"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
          {label.trim().charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate">{label}</span>
      </button>

      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-card shadow-glow"
          >
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-xs text-fg">{email}</p>
              <p className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-faint">{role}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/videos');
              }}
              className="block w-full px-3 py-2 text-left text-xs text-dim hover:bg-raised hover:text-fg"
            >
              Video library
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/jobs');
              }}
              className="block w-full px-3 py-2 text-left text-xs text-dim hover:bg-raised hover:text-fg"
            >
              Job queue
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void logout().then(() => navigate('/dataset'));
              }}
              className="block w-full border-t border-line px-3 py-2 text-left text-xs text-dim hover:bg-raised hover:text-fg"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const scope = useAuthStore((s) => s.scope);

  return (
    <div className="portal-wash flex min-h-screen flex-col bg-base text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/scrape" className="flex shrink-0 items-center gap-2" aria-label="RecSterio home">
            <img
              src="/logo.png"
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px] rounded-full ring-1 ring-line"
            />
            <span className="font-display text-[15px] font-bold tracking-tight text-fg">
              RecSterio
            </span>
          </Link>

          <nav aria-label="Primary" className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 sm:ml-4">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-fg text-base'
                      : 'text-dim hover:bg-raised hover:text-fg'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {scope ? (
              <span className="hidden items-center gap-1 rounded-full border border-accent/30 bg-raised px-2 py-1 text-2xs text-dim sm:inline-flex">
                <KeyIcon size={11} />
                {scope.access === 'passcode' ? 'passcode access' : 'shared with you'}
              </span>
            ) : null}
            {isMockEnabled() ? (
              <span className="chip border-warn/40 bg-warn-soft text-warn">demo</span>
            ) : null}
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="icon-btn"
              aria-label="Open a private folder with a passcode"
              title="Have a passcode?"
            >
              <KeyIcon size={15} />
            </button>
            <ThemeToggle />
            <Identity />
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="border-t border-line-soft bg-raised/40">
            <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5 text-2xs text-faint sm:px-6">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Browsing as a guest — public datasets are open. Sign in to create folders and clean data.
            </p>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-2xs text-faint sm:px-6">
          <span>RecSterio · Khmer–English code-switching dataset</span>
          <span className="font-mono uppercase tracking-wider">Capstone · Group 10</span>
        </div>
      </footer>

      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      <Toast />
    </div>
  );
}
