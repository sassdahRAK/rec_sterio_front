import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { isMockEnabled } from '../api/client';
import { useAuthStore } from '../store/auth';
import BottomNav from './BottomNav';
import ConfirmDialog from './ConfirmDialog';
import ThemeToggle from './ThemeToggle';
import Toast from './Toast';
import { LogoutIcon } from './icons';
import { visibleTabsFor } from './navItems';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
    isActive
      ? 'bg-card font-semibold text-fg shadow-panel dark:bg-raised'
      : 'font-medium text-dim hover:text-fg'
  }`;

export default function Layout() {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [signOutOpen, setSignOutOpen] = useState(false);

  // One filtered list feeds every nav bar; a role without a tab never sees it.
  const visibleTabs = visibleTabsFor(role);

  return (
    <div className="min-h-screen bg-base text-fg">
      <header className="sticky top-0 z-30 bg-base/85 px-4 pb-2 pt-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3 rounded-full border border-line bg-card py-1.5 pl-4 pr-1.5 shadow-panel">
          <div className="flex shrink-0 items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-7 w-7 rounded-full" />
            <h1 className="font-display text-lg font-bold tracking-tight text-fg">RecSterio</h1>
          </div>

          <nav className="mx-auto hidden items-center gap-1 rounded-full bg-raised p-1 dark:bg-black/25 md:flex" aria-label="Primary">
            {visibleTabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
            {isMockEnabled() ? (
              <span className="hidden rounded-full border border-warn/40 bg-warn-soft px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-warn sm:inline">
                demo data
              </span>
            ) : null}
            {email ? (
              <p className="hidden max-w-[16rem] truncate text-xs text-dim lg:block" title={email}>
                {email}
              </p>
            ) : null}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-dim transition-colors hover:text-fg"
            >
              <LogoutIcon size={14} />
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs repeat below the fold line between 640 and 767px; below that
            the floating BottomNav dock takes over. */}
        <nav
          className="mt-2 hidden items-center gap-1 rounded-full border border-line bg-raised p-1 sm:flex md:hidden dark:bg-black/25"
          aria-label="Primary"
        >
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `tap-pad flex flex-1 items-center justify-center rounded-full px-3 py-1.5 text-center text-sm ${
                  isActive ? 'bg-card font-semibold text-fg shadow-panel dark:bg-raised' : 'font-medium text-dim'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* pb clears the floating bottom dock on phones; removed at sm+. */}
      <main className="min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pb-0">
        <Outlet />
      </main>

      <BottomNav />

      <ConfirmDialog
        open={signOutOpen}
        destructive
        title="Sign out?"
        message="You'll need to sign in again to get back to the console."
        confirmLabel="Sign out"
        onConfirm={() => {
          setSignOutOpen(false);
          logout();
          navigate('/login', { replace: true });
        }}
        onCancel={() => setSignOutOpen(false)}
      />

      <Toast />
    </div>
  );
}
