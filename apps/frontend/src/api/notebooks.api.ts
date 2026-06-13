import client from './client';
import type { Note } from './notes.api';

export interface Notebook {
  id: string;
  title: string;
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

export interface NotebookMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string | null; // JSON string (array of citations)
  createdAt: string;
}

export interface Citation {
  noteId: string;
  noteTitle: string;
  snippet: string;
}

export const notebooksApi = {
  findAll: () => client.get<Notebook[]>('/notebooks'),
  findOne: (id: string) => client.get<Notebook>(`/notebooks/${id}`),
  create: (title: string) => client.post<Notebook>('/notebooks', { title }),
  update: (id: string, title: string) => client.patch<Notebook>(`/notebooks/${id}`, { title }),
  remove: (id: string) => client.delete(`/notebooks/${id}`),
  
  addNote: (id: string, noteId: string) => client.post<Notebook>(`/notebooks/${id}/notes/${noteId}`),
  removeNote: (id: string, noteId: string) => client.delete<Notebook>(`/notebooks/${id}/notes/${noteId}`),
  
  getMessages: (id: string) => client.get<NotebookMessage[]>(`/notebooks/${id}/messages`),
  chat: (id: string, payload: { query: string; activeSourceIds?: string[] }) =>
    client.post<{ userMessage: NotebookMessage; assistantMessage: NotebookMessage }>(`/notebooks/${id}/chat`, payload),
  generateGuide: (id: string, payload: { type: 'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table'; activeSourceIds?: string[] }) =>
    client.post<{ title: string; content: string }>(`/notebooks/${id}/generate-guide`, payload),
};
