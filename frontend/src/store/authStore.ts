import { create } from 'zustand';
import { setAccessToken, authApi } from '../api/client';

export interface AuthUser {
  id:          string;
  email:       string;
  firstName:   string;
  lastName:    string;
  isOwner:     boolean;
  roles:       string[];
  permissions: string[];
  tenant:      { id: string; slug: string; name: string; plan: string };
}

interface AuthState {
  user:    AuthUser | null;
  loading: boolean;
  init:    () => Promise<void>;
  login:   (email: string, password: string, tenant: string) => Promise<void>;
  logout:  () => void;
  can:     (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  loading: true,

  init: async () => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) { set({ loading: false }); return; }
    try {
      const data = await authApi.refresh(rt);
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      const me = await authApi.me();
      set({ user: me, loading: false });
    } catch {
      setAccessToken(null);
      localStorage.removeItem('refreshToken');
      set({ loading: false });
    }
  },

  login: async (email, password, tenant) => {
    const data = await authApi.login(email, password, tenant);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const me = await authApi.me();
    set({ user: me });
  },

  logout: () => {
    const rt = localStorage.getItem('refreshToken');
    if (rt) authApi.logout(rt).catch(() => {});
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    set({ user: null });
  },

  can: (module, action) => {
    const { user } = get();
    if (!user) return false;
    return user.permissions.includes(`${module}:${action}`);
  },
}));
