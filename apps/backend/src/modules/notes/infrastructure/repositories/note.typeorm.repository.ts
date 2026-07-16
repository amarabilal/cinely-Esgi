import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from '../../domain/entities/note.entity';
import { INoteRepository, NoteFilters } from '../../domain/repositories/note.repository.interface';

@Injectable()
export class NoteTypeOrmRepository implements INoteRepository {
  constructor(
    @InjectRepository(Note) private readonly repo: Repository<Note>,
  ) {}

  findAll(userId: string, filters: NoteFilters): Promise<Note[]> {
    const qb = this.repo.createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.user_id = :userId', { userId })
      .andWhere('note.is_deleted = false');

    if (filters.archived !== undefined) {
      qb.andWhere('note.is_archived = :archived', { archived: filters.archived });
    } else {
      qb.andWhere('note.is_archived = false');
    }

    if (filters.folderId) {
      qb.andWhere('note.folder_id = :folderId', { folderId: filters.folderId });
    }

    if (filters.favorite) {
      qb.andWhere('note.is_favorite = true');
    }

    if (filters.tagId) {
      qb.innerJoin('note.tags', 'filterTag', 'filterTag.id = :tagId', { tagId: filters.tagId });
    }

    return qb.orderBy('note.is_pinned', 'DESC').addOrderBy('note.updated_at', 'DESC').getMany();
  }

  findById(userId: string, id: string): Promise<Note | null> {
    return this.repo.findOne({
      where: { id, userId, isDeleted: false },
      relations: ['tags'],
    });
  }

  save(note: Partial<Note>): Promise<Note> {
    return this.repo.save(this.repo.create(note));
  }

  async update(userId: string, id: string, partial: Partial<Note>): Promise<void> {
    await this.repo.update({ id, userId }, partial);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.repo.update({ id, userId }, { isDeleted: true, deletedAt: new Date() });
  }

  findDeleted(userId: string): Promise<Note[]> {
    return this.repo.createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.user_id = :userId', { userId })
      .andWhere('note.is_deleted = true')
      .orderBy('note.deleted_at', 'DESC')
      .getMany();
  }

  async restore(userId: string, id: string): Promise<void> {
    await this.repo.update({ id, userId, isDeleted: true }, { isDeleted: false, deletedAt: null });
  }

  async permanentDelete(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId, isDeleted: true });
  }

  async addTag(noteId: string, tagId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .relation(Note, 'tags')
      .of(noteId)
      .add(tagId);
  }

  async removeTag(noteId: string, tagId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .relation(Note, 'tags')
      .of(noteId)
      .remove(tagId);
  }

  search(userId: string, query: string): Promise<Note[]> {
    return this.repo.createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.user_id = :userId', { userId })
      .andWhere('note.is_deleted = false')
      .andWhere('note.is_archived = false')
      .andWhere('(note.title ILIKE :q OR note.content ILIKE :q)', { q: `%${query}%` })
      .orderBy('note.updated_at', 'DESC')
      .getMany();
  }

  async searchSemantic(userId: string, embeddingJson: string): Promise<Note[]> {
    const rows: Array<{ id: string }> = await this.repo.manager.query(
      `SELECT id FROM notes
       WHERE user_id = $1 AND is_deleted = false AND is_archived = false AND embedding IS NOT NULL
         AND (embedding::vector <=> $2::vector) < 0.6
       ORDER BY embedding::vector <=> $2::vector
       LIMIT 20`,
      [userId, embeddingJson],
    );
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const notes = await this.repo.createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.id IN (:...ids)', { ids })
      .getMany();
    const order = new Map(rows.map((r, i) => [r.id, i]));
    return notes.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }

  async updateEmbedding(noteId: string, embeddingJson: string): Promise<void> {
    await this.repo.update({ id: noteId }, { embedding: embeddingJson });
  }

  async findByPublicToken(token: string): Promise<Note | null> {
    return this.repo.findOne({
      where: { publicToken: token, isPublic: true, isDeleted: false },
      relations: ['tags'],
    });
  }
}
