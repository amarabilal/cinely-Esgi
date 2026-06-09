import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type User } from '@/api/auth.api';
import { getAccessToken, setAccessToken, clearAccessToken, setRefreshToken, clearRefreshToken } from '@/lib/tokenStore';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(getAccessToken());
  const pendingTwoFactor = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  async function setToken(token: string, refreshToken?: string) {
    accessToken.value = token;
    setAccessToken(token);
    if (refreshToken) await setRefreshToken(refreshToken); // no-op on web
  }

  // Keep the Pinia ref in step with a silent refresh performed by the axios
  // interceptor (which writes localStorage but cannot import this store
  // statically). localStorage is already updated by the interceptor.
  function syncAccessToken(token: string) {
    accessToken.value = token;
  }

  async function clearAuth() {
    user.value = null;
    accessToken.value = null;
    pendingTwoFactor.value = null;
    clearAccessToken();
    await clearRefreshToken(); // no-op on web
  }

  async function register(payload: { email: string; password: string; firstName: string; lastName: string }) {
    const { data } = await authApi.register(payload);
    await setToken(data.accessToken, data.refreshToken);
    await fetchMe();
  }

  async function login(payload: { email: string; password: string }): Promise<{ twoFactorRequired: boolean }> {
    const { data } = await authApi.login(payload);
    if (data.twoFactorRequired && data.tempToken) {
      pendingTwoFactor.value = data.tempToken;
      return { twoFactorRequired: true };
    }
    await setToken(data.accessToken!, data.refreshToken);
    await fetchMe();
    return { twoFactorRequired: false };
  }

  async function verifyTwoFactor(code: string) {
    if (!pendingTwoFactor.value) throw new Error('No pending 2FA session');
    const { data } = await authApi.verify2fa({ tempToken: pendingTwoFactor.value, code });
    pendingTwoFactor.value = null;
    await setToken(data.accessToken, data.refreshToken);
    await fetchMe();
  }

  function cancelTwoFactor() {
    pendingTwoFactor.value = null;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    await clearAuth();
  }

  async function fetchMe() {
    const { data } = await authApi.me();
    user.value = data;
  }

  return {
    user, accessToken, pendingTwoFactor, isAuthenticated,
    login, logout, register, fetchMe, clearAuth,
    verifyTwoFactor, cancelTwoFactor, syncAccessToken,
  };
});
