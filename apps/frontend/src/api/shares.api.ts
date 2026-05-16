import client from './client';

export interface Share {
  id: string;
  permission: 'READ' | 'WRITE';
  sharedWith: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export const sharesApi = {
  getShares: (noteId: string) =>
    client.get<Share[]>(`/notes/${noteId}/shares`),

  shareNote: (noteId: string, email: string, permission: 'READ' | 'WRITE') =>
    client.post(`/notes/${noteId}/shares`, { email, permission }),

  updatePermission: (noteId: string, shareId: string, permission: 'READ' | 'WRITE') =>
    client.patch(`/notes/${noteId}/shares/${shareId}`, { permission }),

  revokeShare: (noteId: string, shareId: string) =>
    client.delete(`/notes/${noteId}/shares/${shareId}`),
};
