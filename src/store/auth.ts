import { create } from 'zustand';
import {
  ApiError,
  authApi,
  EMAIL_STORAGE_KEY,
  EXPIRES_STORAGE_KEY,
  isMockEnabled,
  TOKEN_STORAGE_KEY,
  UNAUTHORIZED_EVENT,
} from '../api/client';
import type { LoginResponse, Role } from '../api/types';

const NAME_STORAGE_KEY = 'recsterio.session.name';
const ROLE_STORAGE_KEY = 'recsterio.session.role';
const SCOPE_STORAGE_KEY = 'recsterio.session.scope';
const ACCESS_STORAGE_KEY = 'recsterio.session.access';

/** Folder access obtained by redeeming a passcode or a share link. */
export interface FolderScope {
  folderId: string;
  access: 'passcode' | 'share';
}

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  role: Role;
  expiresAt: string | null;
  /** True once a real account (admin or Google member) is signed in. */
  isAuthenticated: boolean;
  /** True while a token exists, including the automatic guest session. */
  hasToken: boolean;
  scope: FolderScope | null;
  /** False until the first session restore / guest handshake has finished. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  /** Adopt a token obtained from a passcode or share link. */
  enterScopedFolder: (token: string, scope: FolderScope) => void;
  logout: () => Promise<void>;
  restore: () => void;
  bootstrap: () => Promise<void>;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

function readScope(): FolderScope | null {
  const folderId = readStored(SCOPE_STORAGE_KEY);
  const access = readStored(ACCESS_STORAGE_KEY);
  if (!folderId || (access !== 'passcode' && access !== 'share')) return null;
  return { folderId, access };
}

function persistSession(result: LoginResponse): void {
  writeStored(TOKEN_STORAGE_KEY, result.token);
  writeStored(EMAIL_STORAGE_KEY, result.email || null);
  writeStored(EXPIRES_STORAGE_KEY, result.expires_at);
  writeStored(NAME_STORAGE_KEY, result.name ?? null);
  writeStored(ROLE_STORAGE_KEY, result.role ?? 'admin');
  writeStored(SCOPE_STORAGE_KEY, null);
  writeStored(ACCESS_STORAGE_KEY, null);
}

function clearSession(): void {
  writeStored(TOKEN_STORAGE_KEY, null);
  writeStored(EMAIL_STORAGE_KEY, null);
  writeStored(EXPIRES_STORAGE_KEY, null);
  writeStored(NAME_STORAGE_KEY, null);
  writeStored(ROLE_STORAGE_KEY, null);
  writeStored(SCOPE_STORAGE_KEY, null);
  writeStored(ACCESS_STORAGE_KEY, null);
}

const SIGNED_OUT = {
  token: null,
  email: null,
  name: null,
  role: 'guest' as Role,
  expiresAt: null,
  isAuthenticated: false,
  hasToken: false,
  scope: null,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...SIGNED_OUT,
  ready: false,

  login: async (email, password) => {
    const result = await authApi.login({ email, password });
    persistSession(result);
    set({
      token: result.token,
      email: result.email,
      name: result.name ?? null,
      role: result.role ?? 'admin',
      expiresAt: result.expires_at,
      isAuthenticated: true,
      hasToken: true,
      scope: null,
      ready: true,
    });
  },

  loginWithGoogle: async (credential) => {
    const result = await authApi.google(credential);
    persistSession(result);
    set({
      token: result.token,
      email: result.email,
      name: result.name ?? null,
      role: result.role ?? 'member',
      expiresAt: result.expires_at,
      isAuthenticated: true,
      hasToken: true,
      scope: null,
      ready: true,
    });
  },

  continueAsGuest: async () => {
    if (isMockEnabled()) {
      // Demo mode has its own in-memory dataset; no server session is needed.
      set({ token: 'mock.guest.token', role: 'guest', hasToken: true, ready: true });
      return;
    }
    const session = await authApi.guest();
    writeStored(TOKEN_STORAGE_KEY, session.token);
    writeStored(EXPIRES_STORAGE_KEY, session.expires_at);
    writeStored(ROLE_STORAGE_KEY, 'guest');
    set({
      token: session.token,
      email: null,
      name: null,
      role: 'guest',
      expiresAt: session.expires_at,
      isAuthenticated: false,
      hasToken: true,
      ready: true,
    });
  },

  enterScopedFolder: (token, scope) => {
    writeStored(TOKEN_STORAGE_KEY, token);
    writeStored(ROLE_STORAGE_KEY, 'guest');
    writeStored(SCOPE_STORAGE_KEY, scope.folderId);
    writeStored(ACCESS_STORAGE_KEY, scope.access);
    set({
      token,
      email: null,
      name: null,
      role: 'guest',
      isAuthenticated: false,
      hasToken: true,
      scope,
      ready: true,
    });
  },

  logout: async () => {
    clearSession();
    set({ ...SIGNED_OUT, ready: true });
    // A signed-out visitor still browses the public dataset (#3).
    try {
      await get().continueAsGuest();
    } catch {
      /* offline: the portal will show its error state */
    }
  },

  /** Re-hydrates a session saved in localStorage; drops it when it has expired. */
  restore: () => {
    const token = readStored(TOKEN_STORAGE_KEY);
    const expiresAt = readStored(EXPIRES_STORAGE_KEY);
    if (!token) {
      set({ ...SIGNED_OUT, ready: false });
      return;
    }
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      clearSession();
      set({ ...SIGNED_OUT, ready: false });
      return;
    }
    const role = (readStored(ROLE_STORAGE_KEY) as Role | null) ?? 'admin';
    set({
      token,
      email: readStored(EMAIL_STORAGE_KEY),
      name: readStored(NAME_STORAGE_KEY),
      role,
      expiresAt,
      isAuthenticated: role === 'admin' || role === 'member',
      hasToken: true,
      scope: readScope(),
      ready: true,
    });
  },

  /**
   * Called once at start-up: restore the saved session, or open an anonymous
   * guest session so public data is readable without an account (#3).
   */
  bootstrap: async () => {
    get().restore();
    if (get().hasToken) return;
    try {
      await get().continueAsGuest();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'network_error') {
        set({ ready: true });
        return;
      }
      set({ ready: true });
    }
  },
}));

/** Called once at start-up: drops the session whenever the API answers 401. */
export function registerUnauthorizedHandler(): () => void {
  const handler = (): void => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      void useAuthStore.getState().logout();
    }
  };
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}
