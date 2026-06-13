/**
 * In-app notifications store (web notifications-dropdown parity).
 *
 * - Loads the list over HTTP.
 * - Subscribes to the realtime gateway: the backend auto-joins each socket to
 *   `user:<id>` on connect and emits `notification:new` (see notes.gateway.ts),
 *   so new notifications arrive live with no extra room join.
 * Everything is best-effort: a socket failure just means no live updates.
 */
import { create } from 'zustand';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import type { AppNotification } from '@/lib/types';

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  /** True once the realtime listener has been wired (idempotent guard). */
  wired: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Connect the socket and listen for live notifications. Idempotent. */
  initRealtime: () => Promise<void>;
  /** Clear state (on logout). */
  reset: () => void;
}

function countUnread(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  wired: false,

  load: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<AppNotification[]>('/notifications');
      set({ items: data, unread: countUnread(data), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const { items } = get();
    if (!items.find((n) => n.id === id && !n.read)) return;
    const next = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    set({ items: next, unread: countUnread(next) });
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // best-effort; next load() reconciles
    }
  },

  markAllRead: async () => {
    const next = get().items.map((n) => ({ ...n, read: true }));
    set({ items: next, unread: 0 });
    try {
      await api.patch('/notifications/read-all');
    } catch {
      // best-effort
    }
  },

  remove: async (id) => {
    const next = get().items.filter((n) => n.id !== id);
    set({ items: next, unread: countUnread(next) });
    try {
      await api.delete(`/notifications/${id}`);
    } catch {
      // best-effort
    }
  },

  initRealtime: async () => {
    if (get().wired) return;
    const socket = await connectSocket();
    if (!socket) return;
    set({ wired: true });
    socket.on('notification:new', (notification: AppNotification) => {
      const items = [notification, ...get().items.filter((n) => n.id !== notification.id)];
      set({ items, unread: countUnread(items) });
    });
  },

  reset: () => set({ items: [], unread: 0, loading: false }),
}));
