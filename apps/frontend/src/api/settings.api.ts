import client from './client';

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  totpEnabled: boolean;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface SubscriptionStatus {
  configured: boolean;
  status: string;
  plan: {
    name: string;
    amount: number | null;
    currency: string;
    interval: string | null;
  } | null;
  customerEmail?: string | null;
}

export const settingsApi = {
  getProfile: () =>
    client.get<Profile>('/settings/profile'),

  updateProfile: (data: { firstName: string; lastName: string }) =>
    client.put<Profile>('/settings/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    client.put('/settings/password', data),

  listSessions: () =>
    client.get<SessionInfo[]>('/settings/sessions'),

  revokeSession: (id: string) =>
    client.delete(`/settings/sessions/${id}`),

  setupTotp: () =>
    client.post<{ secret: string; qrDataUrl: string }>('/settings/2fa/setup'),

  enableTotp: (code: string) =>
    client.post<{ message: string; recoveryCodes: string[] }>('/settings/2fa/enable', { code }),

  disableTotp: (code: string) =>
    client.post('/settings/2fa/disable', { code }),

  getSubscription: (sessionId?: string) =>
    client.get<SubscriptionStatus>('/settings/subscription', {
      params: sessionId ? { sessionId } : undefined,
    }),

  createSubscriptionCheckout: () =>
    client.post<{ url: string }>('/settings/subscription/checkout'),
};
