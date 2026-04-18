import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from '../../domain/entities/folder.entity';
import { IFolderRepository } from '../../domain/repositories/folder.repository.interface';

@Injectable()
export class FolderTypeOrmRepository implements IFolderRepository {
  constructor(
    @InjectRepository(Folder) private readonly repo: Repository<Folder>,
  ) {}

  findAll(userId: string): Promise<Folder[]> {
    return this.repo.find({ where: { userId }, order: { name: 'ASC' } });
  }

  findById(userId: string, id: string): Promise<Folder | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  save(folder: Partial<Folder>): Promise<Folder> {
    return this.repo.save(this.repo.create(folder));
  }

  async update(userId: string, id: string, partial: Partial<Folder>): Promise<void> {
    await this.repo.update({ id, userId }, partial);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}
