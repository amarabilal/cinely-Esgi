import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from '../../domain/entities/tag.entity';
import { ITagRepository } from '../../domain/repositories/tag.repository.interface';

@Injectable()
export class TagTypeOrmRepository implements ITagRepository {
  constructor(
    @InjectRepository(Tag) private readonly repo: Repository<Tag>,
  ) {}

  findAll(userId: string): Promise<Tag[]> {
    return this.repo.find({ where: { userId }, order: { name: 'ASC' } });
  }

  findById(userId: string, id: string): Promise<Tag | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  save(tag: Partial<Tag>): Promise<Tag> {
    return this.repo.save(this.repo.create(tag));
  }

  async update(userId: string, id: string, partial: Partial<Tag>): Promise<void> {
    await this.repo.update({ id, userId }, partial);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}
