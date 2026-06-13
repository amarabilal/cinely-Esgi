import { Note } from '../entities/note.entity';

export const NOTE_REPOSITORY = 'NOTE_REPOSITORY';

export interface NoteFilters {
  folderId?: string;
  tagId?: string;
  favorite?: boolean;
  archived?: boolean;
}

export interface INoteRepository {
  findAll(userId: string, filters: NoteFilters): Promise<Note[]>;
  search(userId: string, query: string): Promise<Note[]>;
  searchSemantic(userId: string, embeddingJson: string): Promise<Note[]>;
  findById(userId: string, id: string): Promise<Note | null>;
  save(note: Partial<Note>): Promise<Note>;
  update(userId: string, id: string, partial: Partial<Note>): Promise<void>;
  updateEmbedding(noteId: string, embeddingJson: string): Promise<void>;
  softDelete(userId: string, id: string): Promise<void>;
  findDeleted(userId: string): Promise<Note[]>;
  restore(userId: string, id: string): Promise<void>;
  permanentDelete(userId: string, id: string): Promise<void>;
  addTag(noteId: string, tagId: string): Promise<void>;
  removeTag(noteId: string, tagId: string): Promise<void>;
  findByPublicToken(token: string): Promise<Note | null>;
}
