/** API client for AI notebooks (RAG chat with notes + generated guides). */
import { api } from '@/lib/api';
import type { Notebook, NotebookMessage } from '@/lib/types';

export async function listNotebooks(): Promise<Notebook[]> {
  const { data } = await api.get<Notebook[]>('/notebooks');
  return data;
}

export async function createNotebook(title: string): Promise<Notebook> {
  const { data } = await api.post<Notebook>('/notebooks', { title });
  return data;
}

export async function getNotebook(id: string): Promise<Notebook> {
  const { data } = await api.get<Notebook>(`/notebooks/${id}`);
  return data;
}

export async function renameNotebook(id: string, title: string): Promise<Notebook> {
  const { data } = await api.patch<Notebook>(`/notebooks/${id}`, { title });
  return data;
}

export async function deleteNotebook(id: string): Promise<void> {
  await api.delete(`/notebooks/${id}`);
}

export async function addNoteToNotebook(id: string, noteId: string): Promise<Notebook> {
  const { data } = await api.post<Notebook>(`/notebooks/${id}/notes/${noteId}`);
  return data;
}

export async function removeNoteFromNotebook(id: string, noteId: string): Promise<Notebook> {
  const { data } = await api.delete<Notebook>(`/notebooks/${id}/notes/${noteId}`);
  return data;
}

export async function getNotebookMessages(id: string): Promise<NotebookMessage[]> {
  const { data } = await api.get<NotebookMessage[]>(`/notebooks/${id}/messages`);
  return data;
}

export async function chatNotebook(
  id: string,
  query: string,
  activeSourceIds?: string[],
): Promise<{ userMessage: NotebookMessage; assistantMessage: NotebookMessage }> {
  const { data } = await api.post<{
    userMessage: NotebookMessage;
    assistantMessage: NotebookMessage;
  }>(`/notebooks/${id}/chat`, { query, activeSourceIds });
  return data;
}

export type GuideType =
  | 'briefing'
  | 'faq'
  | 'study-guide'
  | 'timeline'
  | 'flashcards'
  | 'quiz'
  | 'report';

export async function generateGuide(
  id: string,
  type: GuideType,
  activeSourceIds?: string[],
): Promise<{ title: string; content: string }> {
  const { data } = await api.post<{ title: string; content: string }>(
    `/notebooks/${id}/generate-guide`,
    { type, activeSourceIds },
  );
  return data;
}
