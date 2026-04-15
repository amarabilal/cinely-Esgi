import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type User } from '@/api/auth.api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const pendingTwoFactor = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  function setToken(token: string) {
    accessToken.value = token;
    localStorage.setItem('accessToken', token);
  }

  function clearAuth() {
    user.value = null;
    accessToken.value = null;
    pendingTwoFactor.value = null;
    localStorage.removeItem('accessToken');
  }

  async function register(payload: { email: string; password: string; firstName: string; lastName: string }) {
    const { data } = await authApi.register(payload);
    setToken(data.accessToken);
    await fetchMe();
  }

  async function login(payload: { email: string; password: string }): Promise<{ twoFactorRequired: boolean }> {
    const { data } = await authApi.login(payload);
    if (data.twoFactorRequired && data.tempToken) {
      pendingTwoFactor.value = data.tempToken;
      return { twoFactorRequired: true };
    }
    setToken(data.accessToken!);
    await fetchMe();
    return { twoFactorRequired: false };
  }

  async function verifyTwoFactor(code: string) {
    if (!pendingTwoFactor.value) throw new Error('No pending 2FA session');
    const { data } = await authApi.verify2fa({ tempToken: pendingTwoFactor.value, code });
    pendingTwoFactor.value = null;
    setToken(data.accessToken);
    await fetchMe();
  }

  function cancelTwoFactor() {
    pendingTwoFactor.value = null;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    clearAuth();
  }

  async function fetchMe() {
    const { data } = await authApi.me();
    user.value = data;
  }

  return {
    user, accessToken, pendingTwoFactor, isAuthenticated,
    login, logout, register, fetchMe, clearAuth,
    verifyTwoFactor, cancelTwoFactor,
  };
});
