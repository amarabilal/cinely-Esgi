/** AI helpers (Claude Haiku on the backend), mirroring the web ai.api. */
import { api } from '@/lib/api';

export async function suggestTitle(content: string): Promise<string> {
  const { data } = await api.post<{ title: string }>('/ai/suggest-title', { content });
  return data.title;
}

export async function summarizeContent(content: string): Promise<string> {
  const { data } = await api.post<{ summary: string }>('/ai/summarize', { content });
  return data.summary;
}

export async function suggestTags(
  content: string,
  existingTags: string[],
): Promise<string[]> {
  const { data } = await api.post<{ tags: string[] }>('/ai/suggest-tags', {
    content,
    existingTags,
  });
  return data.tags ?? [];
}
