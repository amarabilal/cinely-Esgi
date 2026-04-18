import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ITagRepository, TAG_REPOSITORY } from '../../domain/repositories/tag.repository.interface';
import { CreateTagDto, UpdateTagDto } from '../dto/tag.dto';

@Injectable()
export class TagsService {
  constructor(
    @Inject(TAG_REPOSITORY) private readonly tagRepository: ITagRepository,
  ) {}

  findAll(userId: string) {
    return this.tagRepository.findAll(userId);
  }

  create(userId: string, dto: CreateTagDto) {
    return this.tagRepository.save({
      userId,
      name: dto.name,
      color: dto.color ?? '#6366f1',
    });
  }

  async update(userId: string, id: string, dto: UpdateTagDto) {
    const tag = await this.tagRepository.findById(userId, id);
    if (!tag) throw new NotFoundException('Tag not found');
    await this.tagRepository.update(userId, id, dto);
    return this.tagRepository.findById(userId, id);
  }

  async remove(userId: string, id: string) {
    const tag = await this.tagRepository.findById(userId, id);
    if (!tag) throw new NotFoundException('Tag not found');
    await this.tagRepository.delete(userId, id);
  }
}
