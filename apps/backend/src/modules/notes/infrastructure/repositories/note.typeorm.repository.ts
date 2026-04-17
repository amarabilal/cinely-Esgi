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

    return qb.orderBy('note.updated_at', 'DESC').getMany();
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
}
