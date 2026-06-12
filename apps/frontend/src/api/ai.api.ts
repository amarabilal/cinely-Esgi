import client from './client';

export const aiApi = {
  suggestTitle: (content: string) =>
    client.post<{ title: string }>('/ai/suggest-title', { content }),
  suggestTags: (content: string, existingTags: string[]) =>
    client.post<{ tags: string[] }>('/ai/suggest-tags', { content, existingTags }),
  summarize: (content: string) =>
    client.post<{ summary: string }>('/ai/summarize', { content }),
};
