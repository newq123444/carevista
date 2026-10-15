// src/store/auth.store.ts — Zustand auth store (Bearer token strategy)
import { create } from 'zustand';
import axios from 'axios';
import type { User } from '../types';

const API = (import.meta as any).env?.VITE_API_URL || '/api';

// Axios instance with token injection
export const authAxios = axios.create({ baseURL: API });
authAxios.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cv_access_token');
  if (token) { if (!cfg.headers) cfg.headers = {} as any; (cfg.headers as any)["Authorization"] = `Bearer ${token}`; }
  return cfg;
});

// ── Staying signed in ──────────────────────────────────────────────────────
// Access tokens last 15 minutes. The server has always issued a refresh token
// alongside, but nothing here used it — so every carer was signed out a
// quarter of an hour into a shift, mid-round. Now a 401 first tries a single
// refresh (one at a time, shared by every request waiting on it), retries the
// request, and only signs out if the refresh itself is refused.
let refreshing: Promise<string | null> | null = null;
export function refreshAccessToken(): Promise<string | null> {
  const rt = localStorage.getItem('cv_refresh_token');
  if (!rt) return Promise.resolve(null);
  if (!refreshing) {
    refreshing = axios.post(`${API}/auth/refresh`, { refreshToken: rt })
      .then(({ data }) => {
        if (data?.accessToken) localStorage.setItem('cv_access_token', data.accessToken);
        if (data?.refreshToken) localStorage.setItem('cv_refresh_token', data.refreshToken);
        return data?.accessToken ?? null;
      })
      .catch((err) => {
        // No connection: not a reason to sign anyone out. Let the caller fail
        // as a network error, and try again when the signal is back.
        if (!err?.response) throw err;
        return null;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

const NO_REFRESH = /\/auth\/(login|refresh|logout)$/;

// Also inject token into the shared api axios instance
import('../services/api').then(({ api }) => {
  api.interceptors.request.use(cfg => {
    const token = localStorage.getItem('cv_access_token');
    if (token) { if (!cfg.headers) cfg.headers = {} as any; (cfg.headers as any)["Authorization"] = `Bearer ${token}`; }
    return cfg;
  });
  api.interceptors.response.use(
    r => r,
    async err => {
      const cfg: any = err.config;
      if (err.response?.status === 401 && cfg && !cfg._cvRetried && !NO_REFRESH.test(String(cfg.url || ''))) {
        cfg._cvRetried = true;
        let fresh: string | null = null;
        try { fresh = await refreshAccessToken(); }
        catch { return Promise.reject(err); }        // offline: keep the session
        if (fresh) {
          cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${fresh}` };
          return api.request(cfg);
        }
      }
      if (err.response?.status === 401) {
        localStorage.removeItem('cv_access_token');
        localStorage.removeItem('cv_refresh_token');
        useAuthStore.getState().logout();
      }
      // The server is ahead of its database. Tell the app shell once, so a
      // manager sees "the database needs updating" instead of screens that
      // look empty for no reason.
      if (err.response?.data?.code === 'MIGRATION_PENDING') {
        window.dispatchEvent(new CustomEvent('cv-migration-pending', { detail: err.response.data.error }));
      }
      return Promise.reject(err);
    }
  );
});

// Who is signed in on this device, so the app can open without a signal.
// Names and role only — never the token, never anything about residents.
const USER_KEY = 'cv_user';
function rememberUser(u: User | null) {
  try { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); } catch { /* blocked */ }
}
function rememberedUser(): User | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

function mapUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    role: raw.role,
    firstName: raw.firstName || raw.first_name || '',
    lastName: raw.lastName || raw.last_name || '',
    careHomeId: raw.careHomeId || raw.care_home_id || '',
    careHomeName: raw.careHomeName || raw.care_home_name || 'Care Home',
    phone: raw.phone,
    // Set when a manager issued a one-time password. The app refuses to show
    // anything else until the person has chosen their own.
    mustChangePassword: raw.mustChangePassword === true || raw.must_change_password === true,
  } as User;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  passwordChanged: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      if (data.accessToken) localStorage.setItem('cv_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('cv_refresh_token', data.refreshToken);
      const user = mapUser(data.user || data);
      rememberUser(user);
      set({ user, isLoading: false, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Invalid email or password';
      set({ isLoading: false, error: msg, user: null });
      throw new Error(msg);
    }
  },

  logout: async () => {
    try {
      const token = localStorage.getItem('cv_access_token');
      if (token) await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch { /* ignore */ }
    localStorage.removeItem('cv_access_token');
    localStorage.removeItem('cv_refresh_token');
    rememberUser(null);
    // Resident data cached for offline use goes with the session.
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: 'cv-clear-api-cache' });
      if ((globalThis as any).caches) await caches.delete('cv-api-v1');
    } catch { /* no service worker */ }
    set({ user: null, isLoading: false, error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('cv_access_token');
    if (!token) { set({ user: null, isLoading: false }); return; }
    const me = (t: string) => axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
    try {
      let res;
      try { res = await me(token); }
      catch (err: any) {
        if (err?.response?.status !== 401) throw err;
        const fresh = await refreshAccessToken();     // expired overnight: try once
        if (!fresh) throw err;
        res = await me(fresh);
      }
      const user = mapUser(res.data.user || res.data);
      rememberUser(user);
      set({ user, isLoading: false });
    } catch (err: any) {
      // No signal: open with the person who was signed in on this device, so
      // the round and anything recorded offline still work.
      const cached = rememberedUser();
      if (!err?.response && cached) { set({ user: cached, isLoading: false }); return; }
      localStorage.removeItem('cv_access_token');
      localStorage.removeItem('cv_refresh_token');
      rememberUser(null);
      set({ user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  // Called after a successful change so the user is let through immediately,
  // without a round trip that would still be serving the cached flag.
  passwordChanged: () => set((st) => ({
    user: st.user ? { ...st.user, mustChangePassword: false } : null,
  })),
}));
