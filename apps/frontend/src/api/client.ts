import axios from 'axios';
import { API_BASE_URL, isNative, CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_VALUE } from '@/lib/platform';
import {
  getAccessToken, setAccessToken, clearAccessToken,
  getRefreshToken, setRefreshToken, clearRefreshToken,
} from '@/lib/tokenStore';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

if (isNative) {
  client.defaults.headers.common[CLIENT_PLATFORM_HEADER] = CLIENT_PLATFORM_VALUE;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      let data: { accessToken: string; refreshToken?: string };
      if (isNative) {
        const refreshToken = await getRefreshToken();
        const resp = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { [CLIENT_PLATFORM_HEADER]: CLIENT_PLATFORM_VALUE } },
        );
        data = resp.data;
        if (data.refreshToken) await setRefreshToken(data.refreshToken);
      } else {
        const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        data = resp.data;
      }
      setAccessToken(data.accessToken);

      const { useAuthStore } = await import('@/stores/auth.store');
      useAuthStore().syncAccessToken(data.accessToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return client(original);
    } catch (err) {
      processQueue(err, null);
      clearAccessToken();
      await clearRefreshToken();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
