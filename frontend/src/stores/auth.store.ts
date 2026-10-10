import { create } from 'zustand';

export interface SubscriptionInfo {
  tier_id: string;
  status: string;
  tier?: {
    id: string;
    name: string;
    price_cents: number;
    billing_frequency?: string;
    model_type?: string;
    description?: string;
    badge_text?: string;
    is_active: boolean;
  };
  configs?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  role: string;
  is_active: boolean;
  phone?: string;
  notes?: string;
  created_at?: string;
  last_login_at?: string;
  subscription?: SubscriptionInfo;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName?: string, phone?: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  upgradeToPro: (tierId?: string) => Promise<boolean>;
  upgradeSubscription: (tierId: string, tierName?: string) => Promise<boolean>;
  forgotPassword: (email: string, newPassword?: string) => Promise<boolean>;
  clearMessages: () => void;
}

const API_BASE = '/api';

async function parseResponseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 150) || `HTTP ${res.status}: ${res.statusText}` };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('tableedge_token') || null,
  user: (() => {
    try {
      const saved = localStorage.getItem('tableedge_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  isLoading: false,
  error: null,
  successMessage: null,

  clearMessages: () => set({ error: null, successMessage: null }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.detail || `Sign in failed (HTTP ${res.status})`);
      }

      localStorage.setItem('tableedge_token', data.token);
      localStorage.setItem('tableedge_user', JSON.stringify(data.user));

      set({
        token: data.token,
        user: data.user,
        isLoading: false,
        error: null,
        successMessage: `Welcome back, ${data.user.display_name}!`,
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Login failed. Please check network connection.',
      });
      return false;
    }
  },

  register: async (email: string, password: string, displayName?: string, phone?: string) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          display_name: displayName?.trim() || undefined,
          phone: phone?.trim() || undefined,
        }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.detail || `Registration failed (HTTP ${res.status})`);
      }

      localStorage.setItem('tableedge_token', data.token);
      localStorage.setItem('tableedge_user', JSON.stringify(data.user));

      set({
        token: data.token,
        user: data.user,
        isLoading: false,
        error: null,
        successMessage: 'Account successfully created! You are tagged as a Free Member.',
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Registration failed.',
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('tableedge_token');
    localStorage.removeItem('tableedge_user');
    set({
      token: null,
      user: null,
      error: null,
      successMessage: 'You have been safely signed out.',
    });
  },

  fetchMe: async () => {
    const token = get().token;
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const user = await parseResponseJson(res);
        localStorage.setItem('tableedge_user', JSON.stringify(user));
        set({ user });
      } else if (res.status === 401 || res.status === 403) {
        // Token expired or invalid
        get().logout();
      }
    } catch {
      // Offline / network failure; keep cached user
    }
  },

  upgradeSubscription: async (tierId: string, tierName?: string) => {
    const token = get().token;
    if (!token) {
      set({ error: 'Please sign in to change your subscription.' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier_id: tierId }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.detail || `Subscription change failed (HTTP ${res.status})`);
      }

      localStorage.setItem('tableedge_user', JSON.stringify(data));
      set({
        user: data,
        isLoading: false,
        successMessage: `🎉 Congratulations! Your plan has been successfully updated to ${tierName || data.subscription?.tier?.name || tierId}.`,
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Subscription change failed.',
      });
      return false;
    }
  },

  upgradeToPro: async (tierId: string = 'tier-pro') => {
    return get().upgradeSubscription(tierId, 'Pro Subscriber');
  },

  forgotPassword: async (email: string, newPassword?: string) => {
    set({ isLoading: true, error: null, successMessage: null });
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), new_password: newPassword }),
      });
      const data = await parseResponseJson(res);
      set({
        isLoading: false,
        successMessage: data.message || 'Password reset instructions processed.',
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Failed to process password recovery.',
      });
      return false;
    }
  },
}));
