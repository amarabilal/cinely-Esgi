/**
 * Google integration client (Drive export / Calendar / Gmail), mirroring the
 * web app's endpoints. The connect flow opens the backend OAuth entry point in
 * an external auth browser and returns via the `cinely://google` deep link
 * (the backend redirects there when `platform=mobile`).
 */
import * as WebBrowser from 'expo-web-browser';

import { api } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { getAccessToken } from '@/lib/tokens';
import type { CalendarEvent, GoogleStatus } from '@/lib/types';

/** Deep-link the backend redirects to after a mobile OAuth connect. */
const RETURN_URL = 'cinely://google';

export type ConnectResult =
  | { status: 'success' }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

/**
 * Run the Google OAuth connect flow. Opens an external browser (not a WebView,
 * so Google permits it) and resolves once the backend deep-links back.
 */
export async function connectGoogle(): Promise<ConnectResult> {
  const token = await getAccessToken();
  if (!token) return { status: 'error', message: 'Not signed in' };

  const authUrl = `${API_BASE}/google/auth?token=${encodeURIComponent(token)}&platform=mobile`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);

  if (result.type !== 'success' || !result.url) {
    return { status: 'cancelled' };
  }
  // result.url looks like cinely://google?google_connected=success
  const query = result.url.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  if (params.get('google_connected') === 'success') return { status: 'success' };
  return {
    status: 'error',
    message: params.get('message') || 'Connection failed',
  };
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const { data } = await api.get<GoogleStatus>('/google/status');
  return data;
}

export async function disconnectGoogle(): Promise<void> {
  await api.post('/google/disconnect');
}

export async function exportNoteToDrive(noteId: string): Promise<string> {
  const { data } = await api.post<{ webViewLink: string }>(
    `/google/export-drive/${noteId}`,
  );
  return data.webViewLink;
}

export async function syncNoteToCalendar(
  noteId: string,
  start: Date,
  end: Date,
): Promise<string> {
  const { data } = await api.post<{ htmlLink: string }>(
    `/google/sync-calendar/${noteId}`,
    { start: start.toISOString(), end: end.toISOString() },
  );
  return data.htmlLink;
}

export async function sendNoteEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await api.post('/google/send-email', { to, subject, html });
}

export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const { data } = await api.get<CalendarEvent[]>(
    `/google/calendar-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
  );
  return data;
}
