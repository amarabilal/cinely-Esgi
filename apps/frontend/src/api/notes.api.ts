import client from './client';
import type { Tag } from './tags.api';

export interface Note {
  id: string;
  title: string;
  content: string;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned: boolean;
  folderId: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  sharedPermission?: 'READ' | 'WRITE';
  isPublic?: boolean;
  publicToken?: string | null;
}

export interface NoteQuery {
  folderId?: string;
  tagId?: string;
  favorite?: boolean;
  archived?: boolean;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  versionNumber: number;
  createdAt: string;
}

export interface NoteStats {
  totalNotes: number;
  favoriteNotes: number;
  archivedNotes: number;
  sharedByMe: number;
  sharedWithMe: number;
  recentNotes: Array<{ id: string; title: string; updatedAt: string }>;
  topTags: Array<{ id: string; name: string; color: string; noteCount: number }>;
}

export const notesApi = {
  findAll: (params?: NoteQuery) => client.get<Note[]>('/notes', { params }),
  getStats: () => client.get<NoteStats>('/notes/stats'),
  findOne: (id: string) => client.get<Note>(`/notes/${id}`),
  create: (payload: { title?: string; content?: string; folderId?: string }) =>
    client.post<Note>('/notes', payload),
  duplicateNote: (id: string) => client.post<Note>(`/notes/${id}/duplicate`),
  update: (id: string, payload: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'isFavorite' | 'isArchived'>>) =>
    client.put<Note>(`/notes/${id}`, payload),
  remove: (id: string) => client.delete(`/notes/${id}`),
  toggleFavorite: (id: string) => client.patch<Note>(`/notes/${id}/favorite`),
  toggleArchive: (id: string) => client.patch<Note>(`/notes/${id}/archive`),
  addTag: (noteId: string, tagId: string) => client.post<Note>(`/notes/${noteId}/tags/${tagId}`),
  removeTag: (noteId: string, tagId: string) => client.delete<Note>(`/notes/${noteId}/tags/${tagId}`),
  search: (q: string, semantic = false) =>
    client.get<Note[]>('/notes/search', { params: { q, ...(semantic ? { semantic: 'true' } : {}) } }),
  findSharedWithMe: () => client.get<Note[]>('/notes/shared'),
  getVersions: (id: string) => client.get<NoteVersion[]>(`/notes/${id}/versions`),
  restoreVersion: (noteId: string, versionId: string) =>
    client.post<Note>(`/notes/${noteId}/versions/${versionId}/restore`),
  togglePin: (id: string) => client.patch<Note>(`/notes/${id}/pin`),
  findTrash: () => client.get<Note[]>('/notes/trash'),
  restoreNote: (id: string) => client.patch(`/notes/${id}/restore`),
  permanentDelete: (id: string) => client.delete(`/notes/${id}/permanent`),
  emptyTrash: () => client.delete('/notes/trash'),
  togglePublic: (id: string) => client.patch<Note>(`/notes/${id}/public`),
  findPublicNote: (token: string) => client.get<Note>(`/public/notes/${token}`),
};
