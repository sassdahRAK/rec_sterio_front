import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { isMockEnabled } from '../api/client';
import { useAuthStore } from '../store/auth';
import BottomNav from './BottomNav';
import ConfirmDialog from './ConfirmDialog';
import ThemeToggle from './ThemeToggle';
import Toast from './Toast';
import { ChevronLeftIcon, ChevronRightIcon, LogoutIcon } from './icons';
import { visibleTabsFor } from './navItems';
import { useNavHistory } from '../lib/useNavHistory';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
    isActive
      ? 'bg-card font-semibold text-fg shadow-panel dark:bg-raised'
      : 'font-medium text-dim hover:text-fg'
  }`;

/* Slimmer sibling of ui.ts's `iconBtnCls` for the secondary history row under
 * the header: borderless h-8 w-8 so the row stays ~40px; `tap-pad` still lifts
 * the hit area to 44x44 on coarse pointers. */
const navHistBtnCls =
  'tap-pad inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-dim ' +
  'transition-colors duration-150 hover:bg-raised hover:text-fg focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40';

export default function Layout() {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [signOutOpen, setSignOutOpen] = useState(false);

  // In-app back/forward — disabled at the session edges so the buttons can
  // never walk the browser history out of the console into another site.
  const { goBack, goForward, canBack, canForward } = useNavHistory();

  // One filtered list feeds every nav bar; a role without a tab never sees it.
  const visibleTabs = visibleTabsFor(role);

  return (
    <div className="min-h-screen bg-base text-fg">
      <header className="sticky top-0 z-30 px-4 pb-2 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-[80rem] items-center gap-2 overflow-hidden rounded-full border border-line bg-card px-3 py-1.5 shadow-panel sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-7 w-7 shrink-0 rounded-full" />
            {/* Static wordmark at every breakpoint; active-tab context lives in
                the bottom dock / segmented tabs. Truncate is a last resort:
                everything else in the pill shrinks before the brand clips. */}
            <h1 className="truncate font-display text-lg font-bold tracking-tight text-fg">
              RecSterio
            </h1>
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
              <span
                className="rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-warn sm:px-2.5"
                title="Demo data: nothing here is saved to a server"
              >
                demo<span className="hidden sm:inline"> data</span>
              </span>
            ) : null}
            {email ? (
              <p className="hidden max-w-[16rem] truncate text-xs text-dim lg:block" title={email}>
                {email}
              </p>
            ) : null}
            <ThemeToggle />
            {/* Compact on phones: icon-only until the label fits (sm+). */}
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              title={email ? `Sign out (${email})` : 'Sign out'}
              aria-label="Sign out"
              className="tap-pad inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-dim transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <LogoutIcon size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Browser-style history nav, now a quiet row under the pill. Real
            <button>s: tabbable, Enter/Space via focus styles. Native
            Alt+Left/Right is left alone. Above the tablet sub-nav so the two
            rows never fight; visible at every width, phones included. */}
        <div className="mx-auto mt-1.5 flex max-w-[80rem] items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            disabled={!canBack}
            aria-label="Back"
            title="Back"
            className={navHistBtnCls}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={!canForward}
            aria-label="Forward"
            title="Forward"
            className={navHistBtnCls}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        {/* Tabs repeat below the fold line between 640 and 767px; below that
            the floating BottomNav dock takes over. */}
        <nav
          className="mx-auto mt-2 hidden max-w-[80rem] items-center gap-1 rounded-full border border-line bg-raised p-1 sm:flex md:hidden dark:bg-black/25"
          aria-label="Sections"
        >
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                // min-h-[44px] unconditional: this row is the touch nav
                // between 640 and 767px (tap-pad only pads coarse pointers).
                `tap-pad min-h-[44px] flex flex-1 items-center justify-center rounded-full px-3 py-1.5 text-center text-sm ${
                  isActive ? 'bg-card font-semibold text-fg shadow-panel dark:bg-raised' : 'font-medium text-dim hover:text-fg'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* One max-width rhythm with the header; pb clears the floating bottom
          dock on phones and keeps breathing room at the page foot on sm+. */}
      <main className="mx-auto min-w-0 w-full max-w-[80rem] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pb-10">
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
