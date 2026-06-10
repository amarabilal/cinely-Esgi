/** Zustand auth store. Owns the current user + auth status. */
import { create } from 'zustand';

import { api } from '@/lib/api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/tokens';
import {
  isTwoFactorChallenge,
  type AuthTokens,
  type LoginResponse,
  type TwoFactorChallenge,
  type User,
} from '@/lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  hydrate: () => Promise<void>;
  /** Returns a 2FA challenge if the backend requires it, otherwise null on success. */
  login: (email: string, password: string) => Promise<TwoFactorChallenge | null>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  verify2fa: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

/** Persists tokens, fetches the user, and flips status to authenticated. */
async function establishSession(
  tokens: AuthTokens,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> {
  await setAccessToken(tokens.accessToken);
  await setRefreshToken(tokens.refreshToken);
  const user = await fetchMe();
  set({ user, status: 'authenticated' });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  hydrate: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ user: null, status: 'unauthenticated' });
      return;
    }
    try {
      // The api client transparently refreshes if the access token expired.
      const user = await fetchMe();
      set({ user, status: 'authenticated' });
    } catch {
      await clearTokens();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });

    if (isTwoFactorChallenge(data)) {
      return data;
    }

    await establishSession(data, set);
    return null;
  },

  register: async (payload) => {
    const { data } = await api.post<AuthTokens>('/auth/register', payload);
    await establishSession(data, set);
  },

  verify2fa: async (tempToken, code) => {
    const { data } = await api.post<AuthTokens>('/auth/2fa/verify', {
      tempToken,
      code,
    });
    await establishSession(data, set);
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // Best-effort: ignore network/server errors during logout.
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {
        // no-op
      }
    }
    await clearTokens();
    set({ user: null, status: 'unauthenticated' });
  },
}));
