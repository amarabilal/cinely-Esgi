import client from './client';

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export const tagsApi = {
  findAll: () => client.get<Tag[]>('/tags'),
  create: (payload: { name: string; color?: string }) => client.post<Tag>('/tags', payload),
  update: (id: string, payload: { name?: string; color?: string }) => client.put<Tag>(`/tags/${id}`, payload),
  remove: (id: string) => client.delete(`/tags/${id}`),
};
