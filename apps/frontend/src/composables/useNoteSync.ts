import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { Tag } from '@/api/tags.api';
import { SOCKET_URL } from '@/lib/platform';

export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
}

export interface RemoteCursor extends UserPresence {
  noteId: string;
  from: number;
  to: number;
}

export interface NoteUpdatePayload {
  noteId: string;
  title: string;
  content: string;   // HTML — for store previews and DB
  json?: object;     // ProseMirror JSON — lossless, used for setContent (preserves whitespace)
  from?: number;
  to?: number;
  userId: string;
  userName: string;
  color: string;
  timestamp: number;
}

export interface PermissionChangedPayload {
  noteId: string;
  userId: string;
  permission: 'READ' | 'WRITE';
}

export interface ShareRevokedPayload {
  noteId: string;
  userId: string;
}

export interface NoteTagsUpdatedPayload {
  noteId: string;
  tags: Tag[];
}

export interface NoteDeletedPayload {
  noteId: string;
}

export interface NoteArchivedPayload {
  noteId: string;
}

type Handler<T> = (p: T) => void;

// Module-level singletons
const presentUsers = ref<UserPresence[]>([]);
const remoteCursors = ref<RemoteCursor[]>([]);
let socket: Socket | null = null;
let currentNoteId: string | null = null;

const noteUpdateHandlers: Handler<NoteUpdatePayload>[] = [];
const permissionChangedHandlers: Handler<PermissionChangedPayload>[] = [];
const shareRevokedHandlers: Handler<ShareRevokedPayload>[] = [];
const noteTagsUpdatedHandlers: Handler<NoteTagsUpdatedPayload>[] = [];
const noteDeletedHandlers: Handler<NoteDeletedPayload>[] = [];
const noteArchivedHandlers: Handler<NoteArchivedPayload>[] = [];

function register<T>(list: Handler<T>[], h: Handler<T>) {
  list.push(h);
  return () => { const i = list.indexOf(h); if (i !== -1) list.splice(i, 1); };
}

function getSocket(token: string): Socket {
  if (socket) return socket;

  socket = SOCKET_URL
    ? io(SOCKET_URL, { transports: ['websocket'], auth: { token } })
    : io({ transports: ['websocket'], auth: { token } });

  socket.on('user_joined', (user: UserPresence) => {
    if (!presentUsers.value.find(u => u.userId === user.userId)) {
      presentUsers.value = [...presentUsers.value, user];
    }
  });

  socket.on('user_left', ({ userId }: { userId: string }) => {
    presentUsers.value = presentUsers.value.filter(u => u.userId !== userId);
    remoteCursors.value = remoteCursors.value.filter(c => c.userId !== userId);
  });

  socket.on('note_updated', (p: NoteUpdatePayload) => {
    // Update cursor in sync with content — both arrive in the same event, no race condition
    if (p.from !== undefined && p.to !== undefined) {
      const cursor: RemoteCursor = {
        noteId: p.noteId, userId: p.userId, userName: p.userName, color: p.color,
        from: p.from, to: p.to,
      };
      const idx = remoteCursors.value.findIndex(c => c.userId === p.userId);
      remoteCursors.value = idx !== -1
        ? remoteCursors.value.map((c, i) => i === idx ? cursor : c)
        : [...remoteCursors.value, cursor];
    }
    noteUpdateHandlers.forEach(h => h(p));
  });

  // cursor_updated is only for non-typing cursor moves (click, arrow keys)
  socket.on('cursor_updated', (cursor: RemoteCursor) => {
    const idx = remoteCursors.value.findIndex(c => c.userId === cursor.userId);
    remoteCursors.value = idx !== -1
      ? remoteCursors.value.map((c, i) => i === idx ? cursor : c)
      : [...remoteCursors.value, cursor];
  });

  socket.on('permission_changed', (p: PermissionChangedPayload) => {
    permissionChangedHandlers.forEach(h => h(p));
  });

  socket.on('share_revoked', (p: ShareRevokedPayload) => {
    shareRevokedHandlers.forEach(h => h(p));
  });

  socket.on('note_tags_updated', (p: NoteTagsUpdatedPayload) => {
    noteTagsUpdatedHandlers.forEach(h => h(p));
  });

  socket.on('note_deleted', (p: NoteDeletedPayload) => {
    noteDeletedHandlers.forEach(h => h(p));
  });

  socket.on('note_archived', (p: NoteArchivedPayload) => {
    noteArchivedHandlers.forEach(h => h(p));
  });

  return socket;
}

export function useNoteSync() {
  function connect(token: string) {
    getSocket(token);
  }

  async function joinNote(token: string, noteId: string): Promise<void> {
    if (currentNoteId) leaveNote();
    currentNoteId = noteId;
    presentUsers.value = [];
    remoteCursors.value = [];

    const s = getSocket(token);
    return new Promise(resolve => {
      s.emit('join_note', { noteId }, (res: { users: UserPresence[] }) => {
        presentUsers.value = res?.users ?? [];
        resolve();
      });
    });
  }

  function leaveNote() {
    if (!currentNoteId || !socket) return;
    socket.emit('leave_note', { noteId: currentNoteId });
    currentNoteId = null;
    presentUsers.value = [];
    remoteCursors.value = [];
  }

  function emitUpdate(noteId: string, title: string, content: string, from?: number, to?: number, json?: object) {
    socket?.emit('note_update', { noteId, title, content, from, to, json });
  }

  function emitCursor(noteId: string, from: number, to: number) {
    socket?.emit('cursor_update', { noteId, from, to });
  }

  function onNoteUpdate(h: Handler<NoteUpdatePayload>) {
    return register(noteUpdateHandlers, h);
  }

  function onPermissionChanged(h: Handler<PermissionChangedPayload>) {
    return register(permissionChangedHandlers, h);
  }

  function onShareRevoked(h: Handler<ShareRevokedPayload>) {
    return register(shareRevokedHandlers, h);
  }

  function onTagsUpdated(h: Handler<NoteTagsUpdatedPayload>) {
    return register(noteTagsUpdatedHandlers, h);
  }

  function onNoteDeleted(h: Handler<NoteDeletedPayload>) {
    return register(noteDeletedHandlers, h);
  }

  function onNoteArchived(h: Handler<NoteArchivedPayload>) {
    return register(noteArchivedHandlers, h);
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    currentNoteId = null;
    presentUsers.value = [];
    remoteCursors.value = [];
  }

  return {
    presentUsers, remoteCursors,
    connect, joinNote, leaveNote,
    emitUpdate, emitCursor,
    onNoteUpdate, onPermissionChanged, onShareRevoked,
    onTagsUpdated, onNoteDeleted, onNoteArchived,
    disconnect,
  };
}
