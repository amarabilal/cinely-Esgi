import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor native shell (Android/iOS). */
export const isNative = Capacitor.isNativePlatform();

/** Header value the backend uses to identify native clients (token-in-body refresh). */
export const CLIENT_PLATFORM_HEADER = 'X-Client-Platform';
export const CLIENT_PLATFORM_VALUE = 'capacitor';

/**
 * Where the backend lives.
 * - Web: same origin via Traefik → relative `/api`, same-origin socket.
 * - Native: absolute origin (env override, else the live cluster).
 */
const BACKEND_ORIGIN = isNative
  ? (import.meta.env.VITE_API_BASE_URL || 'https://cinely.fr')
  : '';

/** Axios baseURL. `/api` on web, `https://cinely.fr/api` on native. */
export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

/** socket.io URL. `undefined` on web (same-origin), absolute origin on native. */
export const SOCKET_URL = isNative ? BACKEND_ORIGIN : undefined;
