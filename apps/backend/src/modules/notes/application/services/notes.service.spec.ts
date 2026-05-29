import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NOTE_REPOSITORY } from '../../domain/repositories/note.repository.interface';
import { NoteVersion } from '../../domain/entities/note-version.entity';
import { NoteShare } from '../../domain/entities/note-share.entity';
import { User } from '../../../auth/domain/entities/user.entity';
import { Tag } from '../../../tags/domain/entities/tag.entity';
import { Folder } from '../../../folders/domain/entities/folder.entity';

const makeNote = (overrides = {}) => ({
  id: 'note-1',
  userId: 'user-1',
  title: 'Test note',
  content: '<p>Hello</p>',
  isFavorite: false,
  isArchived: false,
  isDeleted: false,
  folderId: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockNoteRepo = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  search: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  addTag: jest.fn(),
  removeTag: jest.fn(),
});

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  })),
  manager: { query: jest.fn().mockResolvedValue([]) },
});

describe('NotesService', () => {
  let service: NotesService;
  let noteRepository: any;
  let versionRepository: any;
  let shareRepository: any;
  let userRepository: any;
  let tagRepository: any;
  let folderRepository: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: NOTE_REPOSITORY, useValue: mockNoteRepo() },
        { provide: getRepositoryToken(NoteVersion), useValue: mockRepo() },
        { provide: getRepositoryToken(NoteShare), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        { provide: getRepositoryToken(Tag), useValue: { ...mockRepo(), manager: { query: jest.fn().mockResolvedValue([]) } } },
        { provide: getRepositoryToken(Folder), useValue: mockRepo() },
      ],
    }).compile();

    service = module.get(NotesService);
    noteRepository = module.get(NOTE_REPOSITORY);
    versionRepository = module.get(getRepositoryToken(NoteVersion));
    shareRepository = module.get(getRepositoryToken(NoteShare));
    userRepository = module.get(getRepositoryToken(User));
    tagRepository = module.get(getRepositoryToken(Tag));
    folderRepository = module.get(getRepositoryToken(Folder));
  });

  // ── create ──────────────────────────────────────────────────
  describe('create', () => {
    it('crée une note sans dossier', async () => {
      const note = makeNote();
      noteRepository.save.mockResolvedValue(note);

      const result = await service.create('user-1', { title: 'Test', content: '<p>Hello</p>' });
      expect(result).toEqual(note);
      expect(noteRepository.save).toHaveBeenCalled();
    });

    it("vérifie que le dossier appartient à l'utilisateur", async () => {
      folderRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create('user-1', { title: 'T', content: '', folderId: 'folder-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findOne ──────────────────────────────────────────────────
  describe('findOne', () => {
    it('retourne la note si propriétaire', async () => {
      const note = makeNote();
      noteRepository.findById.mockResolvedValue(note);

      const result = await service.findOne('user-1', 'note-1');
      expect(result).toEqual(note);
    });

    it('retourne la note partagée avec sharedPermission', async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue({
        noteId: 'note-1',
        sharedWithId: 'user-2',
        permission: 'READ',
        note: makeNote(),
      });

      const result = await service.findOne('user-2', 'note-1');
      expect(result).toHaveProperty('sharedPermission', 'READ');
    });

    it("lève NotFoundException si pas d'accès", async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('user-x', 'note-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ───────────────────────────────────────────────────
  describe('update', () => {
    it('met à jour une note dont on est propriétaire', async () => {
      const existing = makeNote();
      const updated = makeNote({ title: 'Nouveau titre' });
      noteRepository.findById.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      noteRepository.update.mockResolvedValue(undefined);
      versionRepository.findOne.mockResolvedValue(null);

      const result = await service.update('user-1', 'note-1', { title: 'Nouveau titre' });
      expect(result.title).toBe('Nouveau titre');
    });

    it('permet à un partagé WRITE de mettre à jour', async () => {
      noteRepository.findById.mockResolvedValueOnce(null); // pas propriétaire
      shareRepository.findOne.mockResolvedValue({
        noteId: 'note-1',
        sharedWithId: 'user-2',
        permission: 'WRITE',
        note: makeNote(),
      });
      noteRepository.findById.mockResolvedValueOnce(makeNote({ title: 'Updated' }));
      noteRepository.update.mockResolvedValue(undefined);
      versionRepository.findOne.mockResolvedValue(null);

      const result = await service.update('user-2', 'note-1', { title: 'Updated' });
      expect(result).toBeTruthy();
    });

    it('bloque un partagé READ de mettre à jour', async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue({
        permission: 'READ',
        note: makeNote(),
      });

      await expect(service.update('user-2', 'note-1', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si note inconnue', async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue(null);
      await expect(service.update('user-x', 'note-x', { title: 'T' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────
  describe('remove', () => {
    it('supprime une note dont on est propriétaire (soft delete)', async () => {
      noteRepository.findById.mockResolvedValue(makeNote());
      noteRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('user-1', 'note-1');
      expect(noteRepository.softDelete).toHaveBeenCalledWith('user-1', 'note-1');
    });

    it('lève NotFoundException si note introuvable', async () => {
      noteRepository.findById.mockResolvedValue(null);
      await expect(service.remove('user-1', 'note-x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── addTag / removeTag ────────────────────────────────────────
  describe('addTag', () => {
    it('ajoute un tag à une note', async () => {
      const note = makeNote();
      noteRepository.findById.mockResolvedValue(note);
      tagRepository.findOne.mockResolvedValue({ id: 'tag-1', userId: 'user-1' });
      noteRepository.addTag.mockResolvedValue(undefined);
      noteRepository.findById.mockResolvedValueOnce(note).mockResolvedValueOnce({ ...note, tags: [{ id: 'tag-1' }] });

      const result = await service.addTag('user-1', 'note-1', 'tag-1');
      expect(noteRepository.addTag).toHaveBeenCalledWith('note-1', 'tag-1');
    });

    it('lève NotFoundException si tag inconnu ou non propriétaire', async () => {
      noteRepository.findById.mockResolvedValue(makeNote());
      tagRepository.findOne.mockResolvedValue(null);

      await expect(service.addTag('user-1', 'note-1', 'tag-x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── versioning ────────────────────────────────────────────────
  describe('versioning (saveVersionIfNeeded)', () => {
    it('crée une version si aucune version préexistante', async () => {
      const existing = makeNote();
      const updated = makeNote({ title: 'New Title' });
      noteRepository.findById.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      noteRepository.update.mockResolvedValue(undefined);
      versionRepository.findOne.mockResolvedValue(null); // pas de version précédente
      versionRepository.count.mockResolvedValue(0);
      versionRepository.save.mockResolvedValue({});

      await service.update('user-1', 'note-1', { title: 'New Title' });
      expect(versionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: 'note-1', versionNumber: 1 }),
      );
    });

    it('ne crée pas de version si la dernière est trop récente (< 60s)', async () => {
      const existing = makeNote();
      const updated = makeNote({ title: 'New' });
      noteRepository.findById.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      noteRepository.update.mockResolvedValue(undefined);
      // Dernière version créée il y a 10 secondes → throttle
      versionRepository.findOne.mockResolvedValue({ createdAt: new Date(Date.now() - 10000) });

      await service.update('user-1', 'note-1', { title: 'New' });
      expect(versionRepository.save).not.toHaveBeenCalled();
    });
  });

  // ── getPermission ─────────────────────────────────────────────
  describe('getPermission', () => {
    it("retourne OWNER si l'utilisateur est propriétaire", async () => {
      noteRepository.findById.mockResolvedValue(makeNote());
      const perm = await service.getPermission('user-1', 'note-1');
      expect(perm).toBe('OWNER');
    });

    it('retourne WRITE si partagé en écriture', async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue({ permission: 'WRITE' });
      const perm = await service.getPermission('user-2', 'note-1');
      expect(perm).toBe('WRITE');
    });

    it('lève NotFoundException si aucun accès', async () => {
      noteRepository.findById.mockResolvedValue(null);
      shareRepository.findOne.mockResolvedValue(null);
      await expect(service.getPermission('user-x', 'note-1')).rejects.toThrow(NotFoundException);
    });
  });
});
