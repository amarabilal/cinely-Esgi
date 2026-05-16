import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, type Profile, type SessionInfo } from '@/api/settings.api';

export const useSettingsStore = defineStore('settings', () => {
  const profile = ref<Profile | null>(null);
  const sessions = ref<SessionInfo[]>([]);

  async function fetchProfile() {
    const { data } = await settingsApi.getProfile();
    profile.value = data;
  }

  async function updateProfile(firstName: string, lastName: string) {
    const { data } = await settingsApi.updateProfile({ firstName, lastName });
    profile.value = data;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await settingsApi.changePassword({ currentPassword, newPassword });
  }

  async function fetchSessions() {
    const { data } = await settingsApi.listSessions();
    sessions.value = data;
  }

  async function revokeSession(id: string) {
    await settingsApi.revokeSession(id);
    sessions.value = sessions.value.filter(s => s.id !== id);
  }

  async function setupTotp() {
    const { data } = await settingsApi.setupTotp();
    return data;
  }

  async function enableTotp(code: string): Promise<string[]> {
    const { data } = await settingsApi.enableTotp(code);
    if (profile.value) profile.value.totpEnabled = true;
    return data.recoveryCodes ?? [];
  }

  async function disableTotp(code: string) {
    await settingsApi.disableTotp(code);
    if (profile.value) profile.value.totpEnabled = false;
  }

  return {
    profile, sessions,
    fetchProfile, updateProfile, changePassword,
    fetchSessions, revokeSession,
    setupTotp, enableTotp, disableTotp,
  };
});
