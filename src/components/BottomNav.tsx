import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { visibleTabsFor } from './navItems';

/**
 * Telegram-style bottom navigation for phones only (<sm). The header's pill
 * tab row covers 640-767px, and at <640 this floating bar replaces it.
 *
 * Items are a solid 22px glyph above a label (10px below 430px where the
 * 6-item admin set crowds a small phone, 11px otherwise); the active item is tinted
 * with the accent token (label included), matching how Telegram marks the
 * current tab — no per-item pill here, since the bar itself is the pill.
 * The item set is the same role-filtered TABS the header renders.
 */

const ITEM_BASE =
  'tap-pad flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 py-1.5 text-[10px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 min-[430px]:text-[11px]';

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `${ITEM_BASE} ${isActive ? 'font-semibold text-accent' : 'font-medium text-dim hover:text-fg'}`;

export default function BottomNav() {
  const role = useAuthStore((s) => s.role);
  const visibleTabs = visibleTabsFor(role);

  return (
    <nav
      aria-label="Mobile sections"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 sm:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-full border border-line bg-card/90 px-1.5 py-0.5 shadow-panel backdrop-blur">
        {visibleTabs.map((tab) => (
          // Same NavLink semantics as the header's tabs: no `end`, so nested
          // routes (/videos/:id, /dataset/f/:id) keep their tab highlighted.
          <NavLink key={tab.to} to={tab.to} className={itemClass}>
            <TabIcon to={tab.to} />
            <span className="max-w-full truncate">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* Solid 24-viewBox glyphs (Material-style, Apache-2.0 path data), fill =
 * currentColor so the active tint applies to icon and label together. */

const GLYPH = { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

function TabIcon({ to }: { to: string }) {
  switch (to) {
    case '/overview':
      return <DashboardIcon />;
    case '/videos':
      return <MovieIcon />;
    case '/dataset':
      return <DatabaseIcon />;
    case '/jobs':
      return <JobListIcon />;
    case '/users':
      return <GroupIcon />;
    case '/settings':
      return <SettingsIcon />;
    default:
      return null;
  }
}

function DashboardIcon() {
  // Material `dashboard` solid — four panels, one per corner.
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  );
}

function MovieIcon() {
  // Material `movie` solid — film strip with the top-edge sprocket notches.
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

function DatabaseIcon() {
  // Stacked cylinders — the dataset (same path as the portal's bottom dock).
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M12 2C7.58 2 4 3.79 4 6v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4zm6 16c0 .93-2.68 2-6 2s-6-1.07-6-2v-2.48c1.43.95 3.86 1.48 6 1.48s4.57-.53 6-1.48V18zm0-5c0 .93-2.68 2-6 2s-6-1.07-6-2v-2.48c1.43.95 3.86 1.48 6 1.48s4.57-.53 6-1.48V13zm-6-3c-3.32 0-6-1.07-6-2s2.68-2 6-2 6 1.07 6 2-2.68 2-6 2z" />
    </svg>
  );
}

function JobListIcon() {
  // Material `format_list_bulleted` solid — three bullets, three rows: a job queue.
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
    </svg>
  );
}

function GroupIcon() {
  // Material `group` solid — two heads over a shared body arc.
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function SettingsIcon() {
  // Material `settings` solid — cog with the centre bore.
  return (
    <svg {...GLYPH} fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.63-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.25-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.31-.08.63-.08.94s.02.63.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.25 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}
