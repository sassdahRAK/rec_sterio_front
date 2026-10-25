import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    hint: 'Pipeline health',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: '/videos',
    label: 'Videos',
    hint: 'Ingestion library',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 9.5l5 2.5-5 2.5v-5Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/jobs',
    label: 'Jobs',
    hint: 'Worker queue',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 7h16M4 12h16M4 17h9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="17.5" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Primary" className="flex h-full w-52 shrink-0 flex-col border-r border-line bg-card">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 font-display text-sm font-bold text-accent">
          r
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-tight text-fg">recsterio</p>
          <p className="text-2xs uppercase tracking-[0.16em] text-faint">ops console</p>
        </div>
      </div>

      <ul className="mt-1 flex-1 space-y-0.5 px-2.5">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-fg ring-1 ring-inset ring-accent/30'
                    : 'text-dim hover:bg-raised hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-accent' : 'text-faint group-hover:text-dim'}>
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{item.label}</span>
                    <span className="block text-2xs leading-tight text-faint">{item.hint}</span>
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-4 py-3">
        <p className="text-2xs uppercase tracking-[0.14em] text-faint">API</p>
        <p className="mt-1 truncate font-mono text-2xs text-dim" title={import.meta.env.VITE_API_BASE_URL as string}>
          {(import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:8000/api/v1'}
        </p>
      </div>
    </nav>
  );
}
