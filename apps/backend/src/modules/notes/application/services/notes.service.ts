import { Injectable, Inject, NotFoundException, BadRequestException, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INoteRepository, NOTE_REPOSITORY } from '../../domain/repositories/note.repository.interface';
import { NoteVersion } from '../../domain/entities/note-version.entity';
import { NoteShare, SharePermission } from '../../domain/entities/note-share.entity';
import { Note } from '../../domain/entities/note.entity';
import { User } from '../../../auth/domain/entities/user.entity';
import { Tag } from '../../../tags/domain/entities/tag.entity';
import { Folder } from '../../../folders/domain/entities/folder.entity';
import { AiService } from '../../../ai/application/services/ai.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { QueryNotesDto } from '../dto/query-notes.dto';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NotesGateway } from '../../infrastructure/gateways/notes.gateway';
import { ActivityService } from '../../../activity/application/services/activity.service';

const VERSION_THROTTLE_SECONDS = 60;

export type NoteWithPermission = Note & { sharedPermission?: 'READ' | 'WRITE' };

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: INoteRepository,
    @InjectRepository(NoteVersion) private readonly versionRepository: Repository<NoteVersion>,
    @InjectRepository(NoteShare) private readonly shareRepository: Repository<NoteShare>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Tag) private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Folder) private readonly folderRepository: Repository<Folder>,
    private readonly aiService: AiService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotesGateway)) private readonly notesGateway: NotesGateway,
    private readonly activityService: ActivityService,
  ) {}

  findAll(userId: string, query: QueryNotesDto) {
    return this.noteRepository.findAll(userId, {
      folderId: query.folderId,
      tagId: query.tagId,
      favorite: query.favorite,
      archived: query.archived,
    });
  }

  search(userId: string, q: string) {
    return this.noteRepository.search(userId, q);
  }

  async searchSemantic(userId: string, q: string) {
    try {
      const key = process.env.OPENAI_API_KEY;
      if (!key || key === 'sk-proj-...' || key.includes('...')) {
        throw new Error('OpenAI API key is missing or is a placeholder.');
      }
      const embedding = await this.aiService.generateEmbedding(q);
      const results = await this.noteRepository.searchSemantic(userId, JSON.stringify(embedding));
      if (results.length === 0) {
        this.logger.log(`No semantic results found. Falling back to keyword search for "${q}".`);
        return this.noteRepository.search(userId, q);
      }
      return results;
    } catch (error: any) {
      this.logger.warn(`Semantic search failed (${error.message}). Falling back to keyword search.`);
      return this.noteRepository.search(userId, q);
    }
  }

  async findOne(userId: string, id: string): Promise<NoteWithPermission> {
    const owned = await this.noteRepository.findById(userId, id);
    if (owned) return owned;

    const share = await this.shareRepository.findOne({
      where: { noteId: id, sharedWithId: userId },
      relations: ['note', 'note.tags'],
    });
    if (share?.note && !share.note.isDeleted) {
      return { ...share.note, sharedPermission: share.permission };
    }

    throw new NotFoundException('Note not found');
  }

  async findSharedWithMe(userId: string): Promise<NoteWithPermission[]> {
    const shares = await this.shareRepository.find({
      where: { sharedWithId: userId },
      relations: ['note', 'note.tags'],
    });
    return shares
      .filter((s): s is typeof s & { note: Note } => !!s.note && !s.note.isDeleted)
      .map(s => ({ ...s.note, sharedPermission: s.permission }));
  }

  async hasAccess(userId: string, noteId: string): Promise<boolean> {
    const owned = await this.noteRepository.findById(userId, noteId);
    if (owned) return true;
    const share = await this.shareRepository.findOne({ where: { noteId, sharedWithId: userId } });
    return !!share;
  }

  async getPermission(userId: string, noteId: string): Promise<'OWNER' | 'READ' | 'WRITE'> {
    const owned = await this.noteRepository.findById(userId, noteId);
    if (owned) return 'OWNER';
    const share = await this.shareRepository.findOne({ where: { noteId, sharedWithId: userId } });
    if (share) return share.permission;
    throw new NotFoundException('Note not found');
  }

  async create(userId: string, dto: CreateNoteDto) {
    if (dto.folderId) {
      const folder = await this.folderRepository.findOne({ where: { id: dto.folderId, userId } });
      if (!folder) throw new NotFoundException('Folder not found');
    }
    const note = await this.noteRepository.save({
      userId,
      title: dto.title ?? '',
      content: dto.content ?? '',
      folderId: dto.folderId ?? null,
      tags: [],
    });
    this.scheduleEmbedding(note.id, note.title, note.content);
    void this.activityService.log(userId, 'CREATE', 'NOTE', note.id, { title: note.title });
    return note;
  }

  async duplicate(userId: string, id: string): Promise<Note> {
    const original = await this.findOne(userId, id);
    const duplicated = await this.noteRepository.save({
      userId,
      title: original.title ? `${original.title} (Copy)` : 'Copy',
      content: original.content,
      folderId: original.folderId,
      tags: [],
    });

    if (original.tags && original.tags.length > 0) {
      for (const tag of original.tags) {
        await this.noteRepository.addTag(duplicated.id, tag.id);
      }
    }

    this.scheduleEmbedding(duplicated.id, duplicated.title, duplicated.content);
    void this.activityService.log(userId, 'DUPLICATE', 'NOTE', duplicated.id, { title: duplicated.title });
    return this.findOne(userId, duplicated.id);
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    let existing = await this.noteRepository.findById(userId, id);
    let ownerId = userId;

    if (!existing) {
      // User is not the owner — check for WRITE permission via share
      const share = await this.shareRepository.findOne({
        where: { noteId: id, sharedWithId: userId },
        relations: ['note', 'note.tags'],
      });
      if (!share || share.permission !== 'WRITE' || !share.note || share.note.isDeleted) {
        throw new NotFoundException('Note not found');
      }
      existing = share.note;
      ownerId = existing.userId;
      // Shared users cannot change folder assignment
      delete (dto as Partial<typeof dto>).folderId;
    }

    if (dto.folderId) {
      const folder = await this.folderRepository.findOne({ where: { id: dto.folderId, userId } });
      if (!folder) throw new NotFoundException('Folder not found');
    }

    const contentChanged =
      (dto.title !== undefined && dto.title !== existing.title) ||
      (dto.content !== undefined && dto.content !== existing.content);

    if (contentChanged) {
      await this.saveVersionIfNeeded(id, existing.title, existing.content);
    }

    await this.noteRepository.update(ownerId, id, dto);
    const updated = await this.noteRepository.findById(ownerId, id);
    if (contentChanged && updated) {
      this.scheduleEmbedding(id, updated.title, updated.content);
      void this.activityService.log(userId, 'EDIT', 'NOTE', id, { title: updated.title });
      try {
        const editorUser = await this.userRepository.findOne({ where: { id: userId } });
        const editorName = editorUser ? `${editorUser.firstName} ${editorUser.lastName}` : 'Un utilisateur';
        const message = `${editorName} a mis à jour la note "${updated.title || 'Sans titre'}".`;
        
        if (updated.userId !== userId) {
          const notification = await this.notificationsService.create(updated.userId, 'EDIT', message, { noteId: id });
          this.notesGateway.sendNotification(updated.userId, notification);
        }
        
        const shares = await this.shareRepository.find({ where: { noteId: id } });
        for (const share of shares) {
          if (share.sharedWithId !== userId) {
            const notification = await this.notificationsService.create(share.sharedWithId, 'EDIT', message, { noteId: id });
            this.notesGateway.sendNotification(share.sharedWithId, notification);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to send edit notification: ${err.message}`);
      }
    }
    return updated;
  }

  async remove(userId: string, id: string) {
    const note = await this.noteRepository.findById(userId, id);
    if (!note) throw new NotFoundException('Note not found');
    await this.noteRepository.softDelete(userId, id);
    void this.activityService.log(userId, 'DELETE', 'NOTE', id, { title: note.title });
  }

  findDeleted(userId: string) {
    return this.noteRepository.findDeleted(userId);
  }

  async restoreNote(userId: string, id: string) {
    const deleted = await this.noteRepository.findDeleted(userId);
    const note = deleted.find(n => n.id === id);
    if (!note) throw new NotFoundException('Note not found in trash');
    await this.noteRepository.restore(userId, id);
    void this.activityService.log(userId, 'RESTORE', 'NOTE', id, { title: note.title });
  }

  async permanentDelete(userId: string, id: string) {
    const deleted = await this.noteRepository.findDeleted(userId);
    const note = deleted.find(n => n.id === id);
    if (!note) throw new NotFoundException('Note not found in trash');
    await this.noteRepository.permanentDelete(userId, id);
  }

  async emptyTrash(userId: string) {
    const deleted = await this.noteRepository.findDeleted(userId);
    for (const note of deleted) {
      await this.noteRepository.permanentDelete(userId, note.id);
    }
  }

  async addTag(userId: string, noteId: string, tagId: string) {
    const note = await this.noteRepository.findById(userId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const tag = await this.tagRepository.findOne({ where: { id: tagId, userId } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.noteRepository.addTag(noteId, tagId);
    return this.noteRepository.findById(userId, noteId);
  }

  async removeTag(userId: string, noteId: string, tagId: string) {
    const note = await this.noteRepository.findById(userId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const tag = await this.tagRepository.findOne({ where: { id: tagId, userId } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.noteRepository.removeTag(noteId, tagId);
    return this.noteRepository.findById(userId, noteId);
  }

  async getVersions(userId: string, noteId: string) {
    await this.findOne(userId, noteId);
    return this.versionRepository.find({
      where: { noteId },
      order: { versionNumber: 'DESC' },
    });
  }

  async restoreVersion(userId: string, noteId: string, versionId: string) {
    const note = await this.noteRepository.findById(userId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const version = await this.versionRepository.findOne({ where: { id: versionId, noteId } });
    if (!version) throw new NotFoundException('Version not found');
    await this.saveVersionIfNeeded(noteId, note.title, note.content);
    await this.noteRepository.update(userId, noteId, {
      title: version.title,
      content: version.content,
    });
    return this.noteRepository.findById(userId, noteId);
  }

  async getShares(ownerId: string, noteId: string) {
    const note = await this.noteRepository.findById(ownerId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const shares = await this.shareRepository.find({
      where: { noteId },
      relations: ['sharedWith'],
    });
    return shares.map(s => ({
      id: s.id,
      permission: s.permission,
      sharedWith: {
        id: s.sharedWith.id,
        email: s.sharedWith.email,
        firstName: s.sharedWith.firstName,
        lastName: s.sharedWith.lastName,
      },
      createdAt: s.createdAt,
    }));
  }

  async shareNote(ownerId: string, noteId: string, email: string, permission: SharePermission) {
    const note = await this.noteRepository.findById(ownerId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const targetUser = await this.userRepository.findOne({ where: { email } });
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === ownerId) throw new BadRequestException('Cannot share with yourself');
    await this.shareRepository.upsert(
      { noteId, sharedWithId: targetUser.id, permission },
      { conflictPaths: ['noteId', 'sharedWithId'] },
    );
    void this.activityService.log(ownerId, 'SHARE', 'NOTE', noteId, { title: note.title, sharedWithEmail: email, permission });
    try {
      const owner = await this.userRepository.findOne({ where: { id: ownerId } });
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : 'Un utilisateur';
      const message = `${ownerName} a partagé la note "${note.title || 'Sans titre'}" avec vous.`;
      const notification = await this.notificationsService.create(targetUser.id, 'SHARE', message, { noteId });
      this.notesGateway.sendNotification(targetUser.id, notification);
    } catch (err: any) {
      this.logger.warn(`Failed to send share notification: ${err.message}`);
    }
  }

  async updateSharePermission(
    ownerId: string,
    noteId: string,
    shareId: string,
    permission: SharePermission,
  ): Promise<string> {
    const note = await this.noteRepository.findById(ownerId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const share = await this.shareRepository.findOne({ where: { id: shareId, noteId } });
    if (!share) throw new NotFoundException('Share not found');
    await this.shareRepository.update(shareId, { permission });
    return share.sharedWithId;
  }

  async revokeShare(ownerId: string, noteId: string, shareId: string): Promise<string> {
    const note = await this.noteRepository.findById(ownerId, noteId);
    if (!note) throw new NotFoundException('Note not found');
    const share = await this.shareRepository.findOne({ where: { id: shareId, noteId } });
    if (!share) throw new NotFoundException('Share not found');
    await this.shareRepository.delete(shareId);
    return share.sharedWithId;
  }

  async getStats(userId: string) {
    const [allNotes, favoriteNotes, archivedNotes] = await Promise.all([
      this.noteRepository.findAll(userId, {}),
      this.noteRepository.findAll(userId, { favorite: true }),
      this.noteRepository.findAll(userId, { archived: true }),
    ]);

    const [sharedByMe, sharedWithMe] = await Promise.all([
      this.shareRepository
        .createQueryBuilder('s')
        .innerJoin('s.note', 'n')
        .where('n.userId = :userId AND n.isDeleted = false', { userId })
        .getCount(),
      this.shareRepository.count({ where: { sharedWithId: userId } }),
    ]);

    const recent = [...allNotes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(n => ({ id: n.id, title: n.title || 'Untitled', updatedAt: n.updatedAt }));

    const topTags: Array<{ id: string; name: string; color: string; noteCount: number }> =
      await this.tagRepository.manager.query(
        `SELECT t.id, t.name, t.color, COUNT(nt.note_id)::int AS "noteCount"
         FROM tags t
         LEFT JOIN note_tags nt ON nt.tag_id = t.id
         LEFT JOIN notes n ON n.id = nt.note_id AND n.user_id = $1 AND n.is_deleted = false
         WHERE t.user_id = $1
         GROUP BY t.id, t.name, t.color
         ORDER BY COUNT(nt.note_id) DESC
         LIMIT 5`,
        [userId],
      );

    return {
      totalNotes: allNotes.length,
      favoriteNotes: favoriteNotes.length,
      archivedNotes: archivedNotes.length,
      sharedByMe,
      sharedWithMe,
      recentNotes: recent,
      topTags,
    };
  }

  private scheduleEmbedding(noteId: string, title: string, content: string) {
    const text = `${title} ${content}`;
    this.aiService
      .generateEmbedding(text)
      .then(vec => this.noteRepository.updateEmbedding(noteId, JSON.stringify(vec)))
      .catch(err => this.logger.warn(`Embedding failed for note ${noteId}: ${err.message}`));
  }

  private async saveVersionIfNeeded(noteId: string, title: string, content: string) {
    const last = await this.versionRepository.findOne({
      where: { noteId },
      order: { createdAt: 'DESC' },
    });
    if (last) {
      const diffSec = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
      if (diffSec < VERSION_THROTTLE_SECONDS) return;
    }
    const count = await this.versionRepository.count({ where: { noteId } });
    await this.versionRepository.save({ noteId, title, content, versionNumber: count + 1 });
  }

  async togglePublic(userId: string, id: string): Promise<Note> {
    const note = await this.findOne(userId, id);
    if (note.userId !== userId) {
      throw new BadRequestException('Only the owner can toggle public status');
    }
    const isPublic = !note.isPublic;
    const publicToken = isPublic ? (note.publicToken || require('crypto').randomUUID()) : null;
    
    await this.noteRepository.update(userId, id, { isPublic, publicToken });
    return this.findOne(userId, id);
  }

  async findPublicNote(token: string): Promise<Note> {
    const note = await this.noteRepository.findByPublicToken(token);
    if (!note) throw new NotFoundException('Note public introuvable');
    return note;
  }
}
