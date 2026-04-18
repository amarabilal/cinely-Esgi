import { Tag } from '../entities/tag.entity';

export const TAG_REPOSITORY = 'TAG_REPOSITORY';

export interface ITagRepository {
  findAll(userId: string): Promise<Tag[]>;
  findById(userId: string, id: string): Promise<Tag | null>;
  save(tag: Partial<Tag>): Promise<Tag>;
  update(userId: string, id: string, partial: Partial<Tag>): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}
