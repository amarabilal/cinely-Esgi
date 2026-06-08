import client from './client';

export const aiApi = {
  suggestTitle: (content: string) =>
    client.post<{ title: string }>('/ai/suggest-title', { content }),
};
