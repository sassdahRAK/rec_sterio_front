import { create } from 'zustand';
import { authApi, EMAIL_STORAGE_KEY, EXPIRES_STORAGE_KEY, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT } from '../api/client';

interface AuthState {
  token: string | null;
  email: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => void;
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

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  email: null,
  expiresAt: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const result = await authApi.login({ email, password });
    writeStored(TOKEN_STORAGE_KEY, result.token);
    writeStored(EMAIL_STORAGE_KEY, result.email);
    writeStored(EXPIRES_STORAGE_KEY, result.expires_at);
    set({
      token: result.token,
      email: result.email,
      expiresAt: result.expires_at,
      isAuthenticated: true,
    });
  },

  logout: () => {
    writeStored(TOKEN_STORAGE_KEY, null);
    writeStored(EMAIL_STORAGE_KEY, null);
    writeStored(EXPIRES_STORAGE_KEY, null);
    set({ token: null, email: null, expiresAt: null, isAuthenticated: false });
  },

  /** Re-hydrates a session saved in localStorage; drops it when it has expired. */
  restore: () => {
    const token = readStored(TOKEN_STORAGE_KEY);
    const email = readStored(EMAIL_STORAGE_KEY);
    const expiresAt = readStored(EXPIRES_STORAGE_KEY);
    if (!token) {
      set({ token: null, email: null, expiresAt: null, isAuthenticated: false });
      return;
    }
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      writeStored(TOKEN_STORAGE_KEY, null);
      writeStored(EMAIL_STORAGE_KEY, null);
      writeStored(EXPIRES_STORAGE_KEY, null);
      set({ token: null, email: null, expiresAt: null, isAuthenticated: false });
      return;
    }
    set({ token, email, expiresAt, isAuthenticated: true });
  },
}));

/** Called once at start-up: drops the session whenever the API answers 401. */
export function registerUnauthorizedHandler(): () => void {
  const handler = (): void => {
    useAuthStore.getState().logout();
  };
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}
