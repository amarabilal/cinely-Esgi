import client from './client';

export const devicesApi = {
  register(token: string, platform: string) {
    return client.post('/devices', { token, platform });
  },
  unregister(token: string) {
    return client.delete(`/devices/${encodeURIComponent(token)}`);
  },
};
