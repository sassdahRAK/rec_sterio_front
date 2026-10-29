import type { Role } from '../api/types';
import { OPERATOR_ROLES, SUPER_ADMIN_ONLY } from '../api/types';

export interface Tab {
  to: string;
  label: string;
  /** When set, the tab only shows for these roles (the capability matrix). */
  roles?: Role[];
}

/**
 * The single source of truth for console navigation, shared by the header's
 * nav rows (Layout) and the phone-only bottom dock (BottomNav) so a role can
 * never see one without the other.
 */
export const TABS: Tab[] = [
  { to: '/overview', label: 'Overview', roles: OPERATOR_ROLES },
  { to: '/videos', label: 'Videos' },
  { to: '/dataset', label: 'Dataset' },
  { to: '/jobs', label: 'Jobs', roles: OPERATOR_ROLES },
  { to: '/users', label: 'Users', roles: SUPER_ADMIN_ONLY },
  { to: '/settings', label: 'Settings' },
];

/** One filtered list feeds every nav bar; a role without a tab never sees it. */
export function visibleTabsFor(role: Role): Tab[] {
  return TABS.filter((tab) => !tab.roles || tab.roles.includes(role));
}
