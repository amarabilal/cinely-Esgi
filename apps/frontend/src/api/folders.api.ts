import client from './client';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export const foldersApi = {
  findAll: () => client.get<Folder[]>('/folders'),
  create: (payload: { name: string; parentId?: string }) => client.post<Folder>('/folders', payload),
  update: (id: string, name: string) => client.put<Folder>(`/folders/${id}`, { name }),
  remove: (id: string) => client.delete(`/folders/${id}`),
};
