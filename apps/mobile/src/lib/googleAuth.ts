/**
 * Google SIGN-IN (authentication). Distinct from lib/google.ts, which links an
 * already-signed-in account to Drive/Calendar/Gmail.
 *
 * The backend can't hand a native client the httpOnly refresh cookie, so it
 * deep-links a 60s single-purpose code and we exchange it over HTTPS. No
 * refresh token ever rides in the cinely:// URL.
 */
import * as WebBrowser from 'expo-web-browser';

import { api } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import type { AuthTokens } from '@/lib/types';

/** Deep-link the backend redirects to after a mobile Google sign-in. */
const RETURN_URL = 'cinely://auth';

export type GoogleSignInResult =
  | { status: 'success'; tokens: AuthTokens }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const authUrl = `${API_BASE}/google/login?platform=mobile`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);

  if (result.type !== 'success' || !result.url) {
    return { status: 'cancelled' };
  }

  // result.url looks like cinely://auth?google_login=success&code=<jwt>
  const params = new URLSearchParams(result.url.split('?')[1] ?? '');
  if (params.get('google_login') !== 'success') {
    return { status: 'error', message: params.get('message') || 'Google sign-in failed' };
  }

  const code = params.get('code');
  if (!code) return { status: 'error', message: 'Google sign-in failed' };

  try {
    const { data } = await api.post<AuthTokens>('/auth/google/exchange', { code });
    return { status: 'success', tokens: data };
  } catch {
    return { status: 'error', message: 'Sign-in expired, please try again.' };
  }
}
