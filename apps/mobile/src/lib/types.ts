/** Shared API response types for the Cinely backend. */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  tempToken: string;
}

/** /auth/login may return tokens directly or a 2FA challenge. */
export type LoginResponse = AuthTokens | TwoFactorChallenge;

export function isTwoFactorChallenge(
  res: LoginResponse,
): res is TwoFactorChallenge {
  return (res as TwoFactorChallenge).twoFactorRequired === true;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Note {
  id: string;
  title: string;
  /** HTML string. */
  content: string;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  folderId: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  sharedPermission?: string;
}

/** In-app notification (web notifications dropdown parity). */
export type NotificationType = 'SHARE' | 'EDIT' | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  metadata?: { noteId?: string } | null;
  createdAt: string;
}

/** GET /google/status */
export interface GoogleStatus {
  connected: boolean;
  email?: string;
}

/** A Google Calendar event (subset we render). */
export interface CalendarEvent {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** AI notebook. `notes` is only populated by GET /notebooks/:id. */
export interface Notebook {
  id: string;
  title: string;
  notes?: Note[];
  createdAt: string;
  updatedAt: string;
}

/** A chat message inside a notebook. */
export interface NotebookMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string | null;
  createdAt: string;
}

/** A note summary as returned in the dashboard "recentNotes" list. */
export interface RecentNote {
  id: string;
  title: string;
  updatedAt: string;
}

/** A tag with usage count, as returned in the dashboard "topTags" list. */
export interface TopTag {
  id: string;
  name: string;
  color: string;
  noteCount: number;
}

/** Permission level for a note share. */
export type SharePermission = 'READ' | 'WRITE';

/**
 * A single collaborator on a note, as returned by GET /notes/:id/shares.
 */
export interface NoteShare {
  id: string;
  permission: SharePermission;
  sharedWith: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

/** Response shape of GET /notes/stats. */
export interface NotesStats {
  totalNotes: number;
  favoriteNotes: number;
  archivedNotes: number;
  sharedByMe: number;
  sharedWithMe: number;
  recentNotes: RecentNote[];
  topTags: TopTag[];
}
