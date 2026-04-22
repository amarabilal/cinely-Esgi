import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notesApi, type Note, type NoteQuery, type NoteVersion } from '@/api/notes.api';
import { foldersApi, type Folder } from '@/api/folders.api';
import { tagsApi, type Tag } from '@/api/tags.api';
import { sharesApi, type Share } from '@/api/shares.api';

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([]);
  const folders = ref<Folder[]>([]);
  const tags = ref<Tag[]>([]);
  const currentNote = ref<Note | null>(null);
  const isSaving = ref(false);
  const searchResults = ref<Note[] | null>(null);
  const versions = ref<NoteVersion[]>([]);
  const sharedNotes = ref<Note[]>([]);
  const shares = ref<Share[]>([]);

  // Track permission per note: 'OWNER' | 'READ' | 'WRITE'
  const notePermissions = ref<Record<string, 'OWNER' | 'READ' | 'WRITE'>>({});

  const currentPermission = computed<'OWNER' | 'READ' | 'WRITE'>(() => {
    if (!currentNote.value) return 'OWNER';
    return notePermissions.value[currentNote.value.id] ?? 'OWNER';
  });

  const canEdit = computed(() => currentPermission.value !== 'READ');

  async function fetchNotes(query?: NoteQuery) {
    const { data } = await notesApi.findAll(query);
    notes.value = data;
    data.forEach(n => { notePermissions.value[n.id] = 'OWNER'; });
  }

  async function fetchFolders() {
    const { data } = await foldersApi.findAll();
    folders.value = data;
  }

  async function fetchTags() {
    const { data } = await tagsApi.findAll();
    tags.value = data;
  }

  async function loadAll(query?: NoteQuery) {
    await Promise.all([fetchNotes(query), fetchFolders(), fetchTags()]);
  }

  async function fetchSharedNotes() {
    const { data } = await notesApi.findSharedWithMe();
    sharedNotes.value = data;
    data.forEach(n => {
      notePermissions.value[n.id] = n.sharedPermission ?? 'READ';
    });
  }

  async function createNote() {
    const { data } = await notesApi.create({ title: '', content: '' });
    notes.value.unshift(data);
    notePermissions.value[data.id] = 'OWNER';
    currentNote.value = data;
    return data;
  }

  async function updateNote(id: string, payload: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'isFavorite' | 'isArchived'>>) {
    isSaving.value = true;
    try {
      const { data } = await notesApi.update(id, payload);
      const idx = notes.value.findIndex((n) => n.id === id);
      if (idx !== -1) notes.value[idx] = data;
      if (currentNote.value?.id === id) currentNote.value = data;
    } finally {
      isSaving.value = false;
    }
  }

  function applyRemoteUpdate(id: string, title: string, content: string) {
    const idx = notes.value.findIndex(n => n.id === id);
    if (idx !== -1) notes.value[idx] = { ...notes.value[idx], title, content };
    const sidx = sharedNotes.value.findIndex(n => n.id === id);
    if (sidx !== -1) sharedNotes.value[sidx] = { ...sharedNotes.value[sidx], title, content };
    if (currentNote.value?.id === id) currentNote.value = { ...currentNote.value, title, content };
  }

  function applyRemoteTagsUpdate(id: string, updatedTags: Tag[]) {
    const idx = notes.value.findIndex(n => n.id === id);
    if (idx !== -1) notes.value[idx] = { ...notes.value[idx], tags: updatedTags };
    const sidx = sharedNotes.value.findIndex(n => n.id === id);
    if (sidx !== -1) sharedNotes.value[sidx] = { ...sharedNotes.value[sidx], tags: updatedTags };
    if (currentNote.value?.id === id) currentNote.value = { ...currentNote.value, tags: updatedTags };
  }

  function applyNoteDeleted(id: string) {
    notes.value = notes.value.filter(n => n.id !== id);
    sharedNotes.value = sharedNotes.value.filter(n => n.id !== id);
    if (currentNote.value?.id === id) currentNote.value = null;
  }

  function applyNoteArchived(id: string) {
    sharedNotes.value = sharedNotes.value.filter(n => n.id !== id);
    if (currentNote.value?.id === id && notePermissions.value[id] !== 'OWNER') {
      currentNote.value = null;
    }
  }

  async function deleteNote(id: string) {
    await notesApi.remove(id);
    notes.value = notes.value.filter((n) => n.id !== id);
    if (currentNote.value?.id === id) currentNote.value = null;
  }

  async function toggleFavorite(id: string) {
    const { data } = await notesApi.toggleFavorite(id);
    const idx = notes.value.findIndex((n) => n.id === id);
    if (idx !== -1) notes.value[idx] = data;
    if (currentNote.value?.id === id) currentNote.value = data;
  }

  async function toggleArchive(id: string) {
    const { data } = await notesApi.toggleArchive(id);
    notes.value = notes.value.filter((n) => n.id !== id);
    if (currentNote.value?.id === id) currentNote.value = null;
  }

  async function addTagToNote(noteId: string, tagId: string) {
    const { data } = await notesApi.addTag(noteId, tagId);
    const idx = notes.value.findIndex((n) => n.id === noteId);
    if (idx !== -1) notes.value[idx] = data;
    if (currentNote.value?.id === noteId) currentNote.value = data;
  }

  async function removeTagFromNote(noteId: string, tagId: string) {
    const { data } = await notesApi.removeTag(noteId, tagId);
    const idx = notes.value.findIndex((n) => n.id === noteId);
    if (idx !== -1) notes.value[idx] = data;
    if (currentNote.value?.id === noteId) currentNote.value = data;
  }

  async function createFolder(name: string) {
    const { data } = await foldersApi.create({ name });
    folders.value.push(data);
    return data;
  }

  async function deleteFolder(id: string) {
    await foldersApi.remove(id);
    folders.value = folders.value.filter((f) => f.id !== id);
  }

  async function createTag(name: string, color: string) {
    const { data } = await tagsApi.create({ name, color });
    tags.value.push(data);
    return data;
  }

  async function deleteTag(id: string) {
    await tagsApi.remove(id);
    tags.value = tags.value.filter((t) => t.id !== id);
  }

  async function search(q: string) {
    if (!q.trim()) { searchResults.value = null; return; }
    const { data } = await notesApi.search(q);
    searchResults.value = data;
  }

  function clearSearch() {
    searchResults.value = null;
  }

  async function fetchVersions(noteId: string) {
    const { data } = await notesApi.getVersions(noteId);
    versions.value = data;
  }

  async function restoreVersion(noteId: string, versionId: string) {
    const { data } = await notesApi.restoreVersion(noteId, versionId);
    const idx = notes.value.findIndex((n) => n.id === noteId);
    if (idx !== -1) notes.value[idx] = data;
    currentNote.value = data;
    versions.value = [];
  }

  async function fetchShares(noteId: string) {
    const { data } = await sharesApi.getShares(noteId);
    shares.value = data;
  }

  async function shareNote(noteId: string, email: string, permission: 'READ' | 'WRITE') {
    await sharesApi.shareNote(noteId, email, permission);
    await fetchShares(noteId);
  }

  async function updateShare(noteId: string, shareId: string, permission: 'READ' | 'WRITE') {
    await sharesApi.updatePermission(noteId, shareId, permission);
    const idx = shares.value.findIndex(s => s.id === shareId);
    if (idx !== -1) shares.value[idx] = { ...shares.value[idx], permission };
  }

  async function revokeShare(noteId: string, shareId: string) {
    await sharesApi.revokeShare(noteId, shareId);
    shares.value = shares.value.filter(s => s.id !== shareId);
  }

  function selectNote(note: Note | null) {
    currentNote.value = note;
    versions.value = [];
    shares.value = [];
    searchResults.value = null;
  }

  return {
    notes, folders, tags, currentNote, isSaving, searchResults, versions,
    sharedNotes, shares, notePermissions, currentPermission, canEdit,
    fetchNotes, fetchFolders, fetchTags, loadAll,
    createNote, updateNote, deleteNote, applyRemoteUpdate, applyRemoteTagsUpdate, applyNoteDeleted, applyNoteArchived,
    toggleFavorite, toggleArchive,
    addTagToNote, removeTagFromNote,
    createFolder, deleteFolder,
    createTag, deleteTag,
    selectNote,
    search, clearSearch,
    fetchVersions, restoreVersion,
    fetchSharedNotes, fetchShares, shareNote, updateShare, revokeShare,
  };
});
