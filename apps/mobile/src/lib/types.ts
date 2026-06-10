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
  folderId: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  sharedPermission?: string;
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
