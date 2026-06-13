/**
 * Realtime collaboration socket (socket.io-client).
 *
 * The backend Socket.IO server lives at the SERVER ROOT (API_URL), NOT under
 * `/api`. The gateway authenticates from `handshake.auth.token` using the JWT
 * access token (see notes.gateway.ts).
 *
 * Realtime is best-effort: every consumer must treat the socket as optional.
 * If the connection fails the editor still works because autosave persists
 * changes over HTTP regardless.
 */
import { io, type Socket } from 'socket.io-client';

import { API_URL } from './config';
import { getAccessToken } from './tokens';

/** Presence entry broadcast by the gateway on join / user_joined. */
export interface Presence {
  userId: string;
  userName: string;
  color: string;
}

/** Payload of the gateway's `note_updated` broadcast. */
export interface NoteUpdatedPayload {
  noteId: string;
  title: string;
  /** HTML content. */
  content: string;
  json?: unknown;
  from?: number;
  to?: number;
  userId: string;
  userName?: string;
  color?: string;
  timestamp?: number;
}

/** Ack returned by the `join_note` emit. */
export interface JoinNoteAck {
  users?: Presence[];
  error?: string;
}

let socket: Socket | null = null;

/**
 * Connects (or reuses) the shared socket, authenticating with the current
 * access token. Returns null if no token is available or connecting throws —
 * callers must handle null gracefully.
 */
export async function connectSocket(): Promise<Socket | null> {
  try {
    if (socket?.connected) return socket;

    const token = await getAccessToken();
    if (!token) return null;

    // Reuse an existing (disconnected) instance with a refreshed token, else
    // create a new one. Recreating avoids a stale-auth handshake.
    if (socket) {
      socket.auth = { token };
      socket.connect();
      return socket;
    }

    socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
      // Keep retries modest; this is a best-effort enhancement.
      reconnectionAttempts: 5,
      autoConnect: true,
    });
    return socket;
  } catch {
    // Never let socket setup break the caller.
    return null;
  }
}

/** Returns the current socket instance if one exists (may be disconnected). */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Tears down the shared socket. Safe to call when nothing is connected.
 * (Not used per-screen — screens just leave their room — but handy on logout.)
 */
export function disconnectSocket(): void {
  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } catch {
    // ignore
  } finally {
    socket = null;
  }
}
