import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notebooksApi, type Notebook, type NotebookMessage } from '@/api/notebooks.api';

export const useNotebooksStore = defineStore('notebooks', () => {
  const notebooks = ref<Notebook[]>([]);
  const currentNotebook = ref<Notebook | null>(null);
  const messages = ref<NotebookMessage[]>([]);
  const activeSourceIds = ref<string[]>([]);
  
  const isLoading = ref(false);
  const isChatting = ref(false);
  const isGenerating = ref(false);

  async function fetchNotebooks() {
    isLoading.value = true;
    try {
      const { data } = await notebooksApi.findAll();
      notebooks.value = data;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchNotebook(id: string) {
    isLoading.value = true;
    try {
      const { data } = await notebooksApi.findOne(id);
      currentNotebook.value = data;
      // Default to having all source notes active
      activeSourceIds.value = data.notes.map(n => n.id);
    } finally {
      isLoading.value = false;
    }
  }

  async function createNotebook(title: string) {
    const { data } = await notebooksApi.create(title);
    notebooks.value.unshift(data);
    return data;
  }

  async function renameNotebook(id: string, title: string) {
    const { data } = await notebooksApi.update(id, title);
    const idx = notebooks.value.findIndex(n => n.id === id);
    if (idx !== -1) notebooks.value[idx] = data;
    if (currentNotebook.value?.id === id) currentNotebook.value.title = title;
    return data;
  }

  async function deleteNotebook(id: string) {
    await notebooksApi.remove(id);
    notebooks.value = notebooks.value.filter(n => n.id !== id);
    if (currentNotebook.value?.id === id) currentNotebook.value = null;
  }

  async function addNoteToNotebook(notebookId: string, noteId: string) {
    const { data } = await notebooksApi.addNote(notebookId, noteId);
    if (currentNotebook.value?.id === notebookId) {
      currentNotebook.value = data;
      // Auto-activate newly added source note
      if (!activeSourceIds.value.includes(noteId)) {
        activeSourceIds.value.push(noteId);
      }
    }
    // Sync with global dashboard list
    const idx = notebooks.value.findIndex(n => n.id === notebookId);
    if (idx !== -1) notebooks.value[idx] = data;
  }

  async function removeNoteFromNotebook(notebookId: string, noteId: string) {
    const { data } = await notebooksApi.removeNote(notebookId, noteId);
    if (currentNotebook.value?.id === notebookId) {
      currentNotebook.value = data;
      activeSourceIds.value = activeSourceIds.value.filter(id => id !== noteId);
    }
    const idx = notebooks.value.findIndex(n => n.id === notebookId);
    if (idx !== -1) notebooks.value[idx] = data;
  }

  async function fetchMessages(notebookId: string) {
    const { data } = await notebooksApi.getMessages(notebookId);
    messages.value = data;
  }

  async function sendMessage(notebookId: string, query: string) {
    isChatting.value = true;
    // Optimistic user message addition
    const tempUserMsg: NotebookMessage = {
      id: Math.random().toString(),
      notebookId,
      role: 'user',
      content: query,
      citations: null,
      createdAt: new Date().toISOString(),
    };
    messages.value.push(tempUserMsg);

    try {
      const { data } = await notebooksApi.chat(notebookId, {
        query,
        activeSourceIds: activeSourceIds.value,
      });
      // Replace temp user message and add assistant response
      messages.value = messages.value.filter(m => m.id !== tempUserMsg.id);
      messages.value.push(data.userMessage, data.assistantMessage);
    } catch (error) {
      // Rollback optimistic update on error
      messages.value = messages.value.filter(m => m.id !== tempUserMsg.id);
      throw error;
    } finally {
      isChatting.value = false;
    }
  }

  async function generateGuide(notebookId: string, type: 'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table') {
    isGenerating.value = true;
    try {
      const { data } = await notebooksApi.generateGuide(notebookId, {
        type,
        activeSourceIds: activeSourceIds.value,
      });
      return data;
    } finally {
      isGenerating.value = false;
    }
  }

  function toggleSourceActive(noteId: string) {
    if (activeSourceIds.value.includes(noteId)) {
      activeSourceIds.value = activeSourceIds.value.filter(id => id !== noteId);
    } else {
      activeSourceIds.value.push(noteId);
    }
  }

  function selectAllSources() {
    if (currentNotebook.value) {
      activeSourceIds.value = currentNotebook.value.notes.map(n => n.id);
    }
  }

  function deselectAllSources() {
    activeSourceIds.value = [];
  }

  return {
    notebooks, currentNotebook, messages, activeSourceIds,
    isLoading, isChatting, isGenerating,
    fetchNotebooks, fetchNotebook, createNotebook, renameNotebook, deleteNotebook,
    addNoteToNotebook, removeNoteFromNotebook,
    fetchMessages, sendMessage, generateGuide,
    toggleSourceActive, selectAllSources, deselectAllSources,
  };
});
