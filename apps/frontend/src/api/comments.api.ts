import client from './client';

export interface Comment {
  id: string;
  noteId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export const commentsApi = {
  findByNoteId: (noteId: string) => client.get<Comment[]>(`/notes/${noteId}/comments`),
  create: (noteId: string, payload: { content: string; parentId?: string }) =>
    client.post<Comment>(`/notes/${noteId}/comments`, payload),
  remove: (noteId: string, commentId: string) => client.delete(`/notes/${noteId}/comments/${commentId}`),
};
