import client from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}

export const authApi = {
  register(payload: { email: string; password: string; firstName: string; lastName: string }) {
    return client.post<{ accessToken: string }>('/auth/register', payload);
  },

  login(payload: { email: string; password: string }) {
    return client.post<{ accessToken?: string; twoFactorRequired?: boolean; tempToken?: string }>('/auth/login', payload);
  },

  verify2fa(payload: { tempToken: string; code: string }) {
    return client.post<{ accessToken: string }>('/auth/2fa/verify', payload);
  },

  logout() {
    return client.post('/auth/logout');
  },

  me() {
    return client.get<User>('/auth/me');
  },

  verifyEmail(token: string) {
    return client.get<{ message: string }>(`/auth/verify-email/${token}`);
  },
};
