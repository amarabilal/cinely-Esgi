/**
 * Axios instance for the Cinely backend.
 *
 * - Attaches the access token (Bearer) on every request.
 * - On a 401, refreshes the token once (single-flight) and retries the request.
 * - On refresh failure, clears tokens and surfaces the error so the auth store
 *   can route back to login.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_BASE, CLIENT_PLATFORM } from './config';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './tokens';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Extends the axios per-request config with our retry marker. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'X-Client-Platform': CLIENT_PLATFORM },
});

// --- Request interceptor: attach Bearer token ---------------------------------
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Single-flight refresh ----------------------------------------------------
let refreshPromise: Promise<string> | null = null;

/**
 * Performs a token refresh using a RAW axios call (not the `api` instance) to
 * avoid interceptor recursion. Concurrent callers share one in-flight refresh.
 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const { data } = await axios.post<RefreshResponse>(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
        { headers: { 'X-Client-Platform': CLIENT_PLATFORM } },
      );
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// --- Response interceptor: refresh + retry on 401 -----------------------------
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      } catch (refreshError) {
        await clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

/** Thin typed helpers (optional sugar over the instance). */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.post<T>(url, body, config);
  return data;
}
