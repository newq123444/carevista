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

// Also inject token into the shared api axios instance
import('../services/api').then(({ api }) => {
  api.interceptors.request.use(cfg => {
    const token = localStorage.getItem('cv_access_token');
    if (token) { if (!cfg.headers) cfg.headers = {} as any; (cfg.headers as any)["Authorization"] = `Bearer ${token}`; }
    return cfg;
  });
  api.interceptors.response.use(
    r => r,
    err => {
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
    set({ user: null, isLoading: false, error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('cv_access_token');
    if (!token) { set({ user: null, isLoading: false }); return; }
    try {
      const { data } = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const user = mapUser(data.user || data);
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem('cv_access_token');
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
